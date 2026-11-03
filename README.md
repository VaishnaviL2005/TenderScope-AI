# TenderScope AI backend

FastAPI backend for tender upload, literal requirement extraction, deterministic OEM catalogue matching, fixture-data cost estimation, SQLite report persistence, and tender-context Q&A.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. Workflow: upload a PDF/DOCX/TXT with `POST /api/v1/tenders/upload`, then call `POST /api/v1/tenders/{tender_id}/analyze`, and retrieve `GET /api/v1/tenders/{tender_id}/report`.

The bundled product catalogue and prices are clearly labelled synthetic fixtures, not real OEM data or commercial quotations. The default extractor returns only values literally present in document text, keeping tests offline and non-fabricating.
