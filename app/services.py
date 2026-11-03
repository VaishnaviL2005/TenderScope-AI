import csv, io, re
from pathlib import Path
from uuid import uuid4
from fastapi import HTTPException, UploadFile
from app.config import settings
from app.schemas import TenderRequirements, ProductRequirement
from app.storage import put_bytes
from app import database

ALLOWED={".pdf",".docx",".txt"}
def save_and_extract(upload: UploadFile):
    name=Path(upload.filename or "").name; ext=Path(name).suffix.lower()
    if ext not in ALLOWED: raise HTTPException(415,"Only PDF, DOCX and TXT files are supported")
    raw=upload.file.read()
    if len(raw)>settings.max_upload_size_mb*1024*1024: raise HTTPException(413,"File exceeds upload size limit")
    if not raw: raise HTTPException(422,"The uploaded file is empty")
    stored=f"{uuid4().hex}{ext}"; path=settings.uploads_dir/stored; path.write_bytes(raw)
    try:
        if ext==".txt": text=raw.decode("utf-8",errors="replace")
        elif ext==".docx":
            from docx import Document
            text="\n".join(p.text for p in Document(io.BytesIO(raw)).paragraphs)
        else:
            import fitz
            with fitz.open(stream=raw,filetype="pdf") as pdf: text="\n".join(f"[Page {i+1}]\n{p.get_text()}" for i,p in enumerate(pdf))
    except Exception as exc:
        path.unlink(missing_ok=True); raise HTTPException(422,"Document is corrupted or cannot be read") from exc
    if not text.strip(): raise HTTPException(422,"No readable text found; scanned PDFs require OCR, which is not enabled")
    if settings.storage_backend == "neon_s3":
        try: put_bytes(f"uploads/{stored}", raw, upload.content_type or "application/octet-stream")
        except Exception as exc: raise HTTPException(503,"Neon Object Storage upload failed") from exc
    return name,stored,text

def _find(pattern,text,cast=str):
    m=re.search(pattern,text,re.I); return cast(m.group(1)) if m else None
def deterministic_extract_requirements(text):
    p=ProductRequirement(product_category=_find(r"(?:product\s*category|category)\s*[:\-]\s*([^\n]+)",text),product_description=_find(r"(?:product\s*description|description)\s*[:\-]\s*([^\n]+)",text),voltage_kv=_find(r"(\d+(?:\.\d+)?)\s*kV",text,float),conductor_material=_find(r"\b(aluminium|aluminum|copper)\b",text),cores=_find(r"\b(\d+)\s*(?:core|cores)\b",text,int),cross_section_mm2=_find(r"\b(\d+(?:\.\d+)?)\s*(?:mm2|mm²|sq\.?\s*mm)",text,float),insulation=_find(r"\b(XLPE|PVC|EPR)\b",text),armour=_find(r"\b(steel wire|steel tape|unarmoured)\b",text),outer_sheath=_find(r"\b(PVC|PE|LSZH)\s*(?:outer )?sheath\b",text),quantity=_find(r"(?:quantity|qty)\s*[:\-]?\s*(\d+(?:\.\d+)?)",text,float),unit=_find(r"(?:quantity|qty)\s*[:\-]?\s*\d+(?:\.\d+)?\s*(metres?|meters?|km|units?)",text),source_reference="document text")
    return TenderRequirements(tender_title=_find(r"(?:tender\s*title|title)\s*[:\-]\s*([^\n]+)",text),reference_number=_find(r"(?:tender\s*(?:reference|no\.?|number)|reference\s*no\.?)\s*[:\-]\s*([^\n]+)",text),description=text[:500],products=[p],required_tests=re.findall(r"(?:test(?:ing)?\s*(?:required)?\s*[:\-]\s*)([^\n]+)",text,re.I)).model_dump()

def read_csv(name):
    path=settings.structured_dir/name
    with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f)) if path.exists() else []
def normalize(value):
    """Canonicalize strings and numeric CSV/text values before comparison."""
    try:
        number=float(value)
        return str(int(number)) if number.is_integer() else str(number)
    except (TypeError, ValueError):
        return str(value or "").strip().lower().replace("aluminum","aluminium")
FIELDS={"voltage_kv":"Rated voltage", "conductor_material":"Conductor material", "cores":"Number of cores", "cross_section_mm2":"Cross-sectional area", "insulation":"Insulation", "armour":"Armour construction", "outer_sheath":"Outer sheath material/grade", "standards":"Applicable standard"}
PRODUCT_FIELD_ALIASES={"armour":("armour","armour_type","armor","armor_type"),"outer_sheath":("outer_sheath","sheath_material","sheath","outer_sheath_material"),"standards":("standards","standard","applicable_standard")}
def product_value(product, field):
    return next((product.get(key) for key in PRODUCT_FIELD_ALIASES.get(field,(field,)) if product.get(key) not in (None,"")), None)
def match_products(requirement, mandatory_fields=None):
    applicable_fields=list(mandatory_fields or [field for field in FIELDS if requirement.get(field) not in (None,"",[])])
    candidates=[]
    for product in database.products():
        comparisons=[]; required=matched=0; critical=False
        for field in applicable_fields:
            label=FIELDS[field]
            wanted=requirement.get(field); actual=product_value(product,field); required+=1
            if field=="standards": equal=bool(wanted and actual and any(normalize(s) in normalize(actual) for s in wanted))
            else: equal=wanted is not None and wanted!="" and normalize(wanted)==normalize(actual)
            result="match" if equal else ("unresolved" if wanted in (None,"",[]) or not actual else "mismatch")
            comparisons.append({"parameter":label,"tender_requirement":wanted,"product_value":actual or "Not stated","result":result}); matched+=int(equal)
            if not equal: critical=True
        if required:candidates.append({"sku_id":product["sku_id"],"product_name":product["product_name"],"match_percentage":round(matched/required*100,2),"comparisons":comparisons,"compliant":not critical,"compliance_warnings":["One or more mandatory technical parameters are mismatched or unresolved"] if critical else [],"source_references":[{"source":product.get("source_document"),"sku_id":product["sku_id"]}]})
    candidates=sorted(candidates,key=lambda x:(x["compliant"],x["match_percentage"]),reverse=True)
    return {"recommendations":candidates[:3],"fully_compliant_product_available":any(x["compliant"] for x in candidates),"method":"Equal-weight deterministic ranking across explicit mandatory parameters; unknown values are not matches and prevent compliance."}

def _test_tokens(value):
    text=normalize(value).replace("high-voltage","high voltage")
    words=re.findall(r"[a-z]+",text)
    # These words add no identity for matching a test price.  Removing them
    # permits wording variants such as DC resistance and withstand test.
    return {word for word in words if word not in {"test","testing","dc","direct","current","withstand","routine","type"}}

def _canonical_test_name(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())).strip()

def find_testing_price(test, records):
    # An exact normalized title is authoritative.  This avoids treating a
    # legacy alias (for example, "Conductor Resistance Test") as ambiguous
    # when the current price list has the tender's full name.
    exact=[record for record in records if _canonical_test_name(record["test_name"]) == _canonical_test_name(test)]
    if len(exact)==1: return exact[0]
    requested=_test_tokens(test)
    matches=[]
    for record in records:
        available=_test_tokens(record["test_name"])
        if requested and available and (requested <= available or available <= requested):
            matches.append(record)
    return matches[0] if len(matches)==1 else None

def calculate_pricing(requirement, technical, required_tests):
    warnings=[]; materials=[]; tests=[]; missing_prices=[]; total=0.0; top=next((x for x in technical.get("recommendations",[]) if x.get("compliant")),None); qty=requirement.get("quantity")
    if not top:warnings.append("No fully compliant product is available; material cost cannot be calculated")
    else:
      price=next((x for x in database.product_prices() if x.get("sku_id")==top["sku_id"]),None)
      if not price:warnings.append(f"No price record for SKU {top['sku_id']}")
      elif qty is None:warnings.append("Quantity is missing; material cost cannot be calculated")
      else:
        cost=float(price["unit_price"])*float(qty); total+=cost; materials.append({"type":"material","sku_id":top["sku_id"],"quantity":qty,"unit_price":float(price["unit_price"]),"currency":price["currency"],"cost":cost})
    for test in required_tests:
      record=find_testing_price(test,database.testing_prices())
      if record:
        cost=float(record["price"]);total+=cost;tests.append({"test_id":record["test_id"],"test_name":record["test_name"],"charge_unit":record["charge_unit"],"cost":cost,"currency":record["currency"]})
      else:
        warning=f"No testing price found for: {test}"; warnings.append(warning); missing_prices.append({"type":"testing","test_name":test,"reason":"No matching testing price record"})
    material_cost=sum(item["cost"] for item in materials) if materials else None
    known_testing_cost=sum(item["cost"] for item in tests)
    pricing_complete=bool(materials) and not missing_prices and not warnings
    return {"material_items":materials,"testing_items":tests,"material_cost":material_cost,"testing_cost":known_testing_cost if not missing_prices else None,"known_testing_cost":known_testing_cost,"known_subtotal":(material_cost or 0)+known_testing_cost,"total_estimated_cost":total if pricing_complete else None,"pricing_complete":pricing_complete,"missing_price_items":missing_prices,"currency":"INR","warnings":warnings,"disclaimer":"A total is returned only when a compliant product and prices for every required component are available. Estimates use synthetic fixture data and are not commercial quotations."}

def review_quality(requirements, technical, pricing, retry_count=0):
    """Independently validate extraction, matching, and pricing outputs."""
    product=(requirements.get("products") or [{}])[0]
    mandatory=requirements.get("mandatory_fields",[])
    missing=[field for field in mandatory if product.get(field) in (None,"",[])]
    for item in pricing.get("missing_price_items",[]):
        missing.append(f"Testing price is not available for: {item['test_name']}")
    recommendations=technical.get("recommendations",[])
    for field in mandatory:
        if recommendations and all(any(c["parameter"] == FIELDS[field] and c["result"] == "unresolved" for c in candidate["comparisons"]) for candidate in recommendations):
            missing.append(f"No candidate provides: {field.replace('_', ' ')}")
    unresolved=[]
    if not technical.get("fully_compliant_product_available"):
        unresolved.append("No fully compliant product is available")
    unresolved.extend(item["test_name"]+": testing price is missing" for item in pricing.get("missing_price_items",[]))
    unresolved.extend(requirements.get("extraction_warnings",[]))
    return {"complete":not missing and not unresolved and pricing.get("pricing_complete",False),"review_status":"issues_found" if missing or unresolved else "passed","missing_information":missing,"missing_information_count":len(missing),"unresolved_requirements":unresolved,"unresolved_requirement_count":len(unresolved),"warnings":pricing["warnings"],"retry_count":retry_count}
def ingest_datasheet(upload):
    name,stored,text=save_and_extract(upload)
    key=f"uploads/{stored}"; database.add_kb_document(uuid4().hex,name,key,text)
    return {"source_filename":name,"stored_filename":stored,"object_key":key,"characters":len(text)}
