from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db,create_tender,get_tender,list_tenders,set_status,begin_analysis,save_analysis,get_analysis,check_connection,products as db_products,product_prices as db_product_prices,testing_prices as db_testing_prices,import_products as db_import_products
from app.schemas import ApiResponse, QuestionRequest
from app.services import save_and_extract,ingest_datasheet
from app.rag import rebuild as rebuild_rag, status as kb_status
from app.workflow import analyze,answer_question
from app.storage import status as storage_status
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

@asynccontextmanager
async def lifespan(app): init_db(); yield
app=FastAPI(title="TenderScope AI",version="1.0.0",description="Tender analysis backend. Fixture prices are synthetic.",lifespan=lifespan)
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "Frontend" / "dist"
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origins.split(","),allow_methods=["*"],allow_headers=["*"])
@app.exception_handler(HTTPException)
async def http_error(_:Request,exc:HTTPException): return JSONResponse(status_code=exc.status_code,content={"success":False,"message":"Unable to process the request","data":{"error_code":"HTTP_ERROR","details":str(exc.detail)}})
@app.exception_handler(RequestValidationError)
async def validation_error(_:Request,exc:RequestValidationError): return JSONResponse(status_code=422,content={"success":False,"message":"Invalid request","data":{"error_code":"VALIDATION_ERROR","details":str(exc.errors())}})
@app.exception_handler(Exception)
async def unexpected_error(_:Request,exc:Exception): return JSONResponse(status_code=500,content={"success":False,"message":"Unable to process the request","data":{"error_code":"INTERNAL_ERROR","details":"Unexpected server error"}})
def ok(message,data=None):return ApiResponse(message=message,data=data)
def tender_or_404(tid):
    item=get_tender(tid)
    if not item:raise HTTPException(404,"Tender not found")
    return item
@app.get("/health",response_model=ApiResponse,tags=["Health"])
@app.get("/api/v1/health",response_model=ApiResponse,tags=["Health"])
def health():
    try: database=check_connection(); storage=storage_status()
    except Exception as exc: raise HTTPException(503,"A required Neon service is unavailable") from exc
    return ok("Backend is healthy",{"database":{"ready":True,"name":database["database"]},"storage":storage,"llm_provider":settings.llm_provider})
@app.post("/api/v1/tenders/upload",response_model=ApiResponse,tags=["Tenders"])
def upload_tender(file:UploadFile=File(...)):
    name,stored,text=save_and_extract(file);tid=f"TDR-{uuid4().hex[:10].upper()}";create_tender(tid,name,stored,text);return ok("Tender uploaded",{"tender_id":tid,"filename":name,"status":"uploaded"})
@app.get("/api/v1/tenders",response_model=ApiResponse,tags=["Tenders"])
def tenders(page:int=1,page_size:int=20):
    if page<1 or not 1<=page_size<=100: raise HTTPException(422,"page must be positive and page_size must be 1-100")
    return ok("Tenders retrieved",list_tenders(page,page_size))
@app.get("/api/v1/tenders/{tender_id}",response_model=ApiResponse,tags=["Tenders"])
def tender(tender_id):
    item=tender_or_404(tender_id);item.pop("text",None);return ok("Tender retrieved",item)
@app.post("/api/v1/tenders/{tender_id}/analyze",response_model=ApiResponse,tags=["Tenders"])
def analyze_tender(tender_id):
    item=tender_or_404(tender_id)
    # The document text is stored with the tender.  Claiming its existing row
    # makes this endpoint safe for both first analysis and re-analysis.
    if not begin_analysis(tender_id): raise HTTPException(409,"Tender analysis is already in progress")
    prior_analysis=get_analysis(tender_id)
    try:
      output=analyze(item["text"]);save_analysis(tender_id,**output);set_status(tender_id,"completed");return ok("Tender analysis completed",{"tender_id":tender_id,"status":"completed","report":output["report"]})
    except Exception:
      # save_analysis is only called after a complete pipeline result.  Keep a
      # prior completed report visible after a failed re-analysis instead of
      # replacing it with a failed/partial result.
      set_status(tender_id,"completed" if prior_analysis else "failed");raise HTTPException(500,"Tender analysis failed; review the document and configured services")
@app.get("/api/v1/tenders/{tender_id}/status",response_model=ApiResponse,tags=["Tenders"])
def status(tender_id):return ok("Status retrieved",{"tender_id":tender_id,"status":tender_or_404(tender_id)["status"]})
@app.get("/api/v1/tenders/{tender_id}/requirements",response_model=ApiResponse,tags=["Tenders"])
def requirements(tender_id):
    item=tender_or_404(tender_id)
    if item["status"]=="processing": raise HTTPException(409,"Analysis is in progress; requirements will refresh when it completes")
    result=get_analysis(tender_id)
    if not result: raise HTTPException(409,"Tender has not been analyzed")
    return ok("Requirements retrieved",result["requirements"])
@app.get("/api/v1/tenders/{tender_id}/report",response_model=ApiResponse,tags=["Tenders"])
def report(tender_id):
    item=tender_or_404(tender_id)
    if item["status"]=="processing": raise HTTPException(409,"Analysis is in progress; the previous report is preserved and the refreshed report will be available when it completes")
    result=get_analysis(tender_id)
    if not result:raise HTTPException(409,"Tender has not been analyzed")
    return ok("Report retrieved",result["report"])
@app.post("/api/v1/tenders/{tender_id}/questions",response_model=ApiResponse,tags=["Tender Q&A"])
def question(tender_id,body:QuestionRequest):
    tender_or_404(tender_id);result=get_analysis(tender_id)
    if not result:raise HTTPException(409,"Analyze the tender before asking questions")
    return ok("Question answered",answer_question(result,body.question))
@app.get("/api/v1/products",response_model=ApiResponse,tags=["Products"])
def products():return ok("Products retrieved",db_products())
@app.post("/api/v1/products/import",response_model=ApiResponse,tags=["Products"])
def import_products(file:UploadFile=File(...)):
    if not (file.filename or "").lower().endswith(".csv"):raise HTTPException(415,"A CSV catalogue is required")
    import csv,io
    rows=list(csv.DictReader(io.StringIO(file.file.read().decode("utf-8-sig"))))
    if not rows: raise HTTPException(422,"CSV contains no product records")
    try: db_import_products(rows)
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc
    return ok("Product catalogue imported",{"records":len(rows)})
@app.post("/api/v1/knowledge-base/ingest",response_model=ApiResponse,tags=["Knowledge Base"])
def ingest(file:UploadFile=File(...)):return ok("Datasheet ingested",ingest_datasheet(file))
@app.post("/api/v1/knowledge-base/rebuild",response_model=ApiResponse,tags=["Knowledge Base"])
def rebuild():
    try:return ok("Knowledge-base rebuild completed",rebuild_rag())
    except RuntimeError as exc:raise HTTPException(503,str(exc)) from exc
@app.get("/api/v1/knowledge-base/status",response_model=ApiResponse,tags=["Knowledge Base"])
def knowledge_status():return ok("Knowledge-base status",kb_status())
@app.get("/api/v1/pricing/products",response_model=ApiResponse,tags=["Pricing"])
def product_prices():return ok("Product prices retrieved",db_product_prices())
@app.get("/api/v1/pricing/tests",response_model=ApiResponse,tags=["Pricing"])
def test_prices():return ok("Testing prices retrieved",db_testing_prices())

# ==========================================
# Serve React Frontend
# ==========================================

if FRONTEND_DIST.exists():

    # Serve React static assets (JS, CSS, images)
    if (FRONTEND_DIST / "assets").is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=FRONTEND_DIST / "assets"),
            name="frontend-assets"
        )

    # Serve React pages and handle frontend routes
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):

        candidate = (FRONTEND_DIST / full_path).resolve()

        if (
            candidate.is_relative_to(FRONTEND_DIST.resolve())
            and candidate.is_file()
        ):
            return FileResponse(candidate)

        return FileResponse(FRONTEND_DIST / "index.html")