"""PostgreSQL persistence using Neon pooled connections for application traffic."""
import json
import csv
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from app.config import settings

engine = create_engine(settings.sqlalchemy_database_url, pool_pre_ping=True)
def now(): return datetime.now(timezone.utc).isoformat()
def init_db():
    with engine.begin() as con:
        con.execute(text("CREATE TABLE IF NOT EXISTS tenders (id VARCHAR(64) PRIMARY KEY, filename TEXT NOT NULL, stored_filename TEXT NOT NULL, status VARCHAR(32) NOT NULL, text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL)"))
        con.execute(text("CREATE TABLE IF NOT EXISTS analyses (tender_id VARCHAR(64) PRIMARY KEY REFERENCES tenders(id), requirements JSONB, technical JSONB, pricing JSONB, quality JSONB, report JSONB, updated_at TIMESTAMPTZ NOT NULL)"))
        con.execute(text("CREATE TABLE IF NOT EXISTS product_catalog (sku_id VARCHAR(128) PRIMARY KEY, product_name TEXT NOT NULL, data JSONB NOT NULL, source_document TEXT)"))
        con.execute(text("CREATE TABLE IF NOT EXISTS product_prices (sku_id VARCHAR(128) PRIMARY KEY, product_name TEXT NOT NULL, unit_price NUMERIC NOT NULL, price_unit TEXT NOT NULL, currency VARCHAR(16) NOT NULL)"))
        con.execute(text("CREATE TABLE IF NOT EXISTS testing_prices (test_id VARCHAR(128) PRIMARY KEY, test_name TEXT NOT NULL, price NUMERIC NOT NULL, charge_unit TEXT NOT NULL, currency VARCHAR(16) NOT NULL)"))
        con.execute(text("CREATE TABLE IF NOT EXISTS knowledge_documents (id VARCHAR(64) PRIMARY KEY, filename TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, extracted_text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL)"))
        # Retain superseded fixture data for auditability while ensuring the
        # live matching and pricing views use only the active data set.
        con.execute(text("ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE"))
        con.execute(text("ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE"))
        con.execute(text("ALTER TABLE testing_prices ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE"))
    seed_company_data()
def create_tender(tid, filename, stored, content):
    with engine.begin() as con: con.execute(text("INSERT INTO tenders VALUES (:id,:filename,:stored,'uploaded',:content,:created)"),{"id":tid,"filename":filename,"stored":stored,"content":content,"created":now()})
def get_tender(tid):
    with engine.connect() as con: row=con.execute(text("SELECT * FROM tenders WHERE id=:id"),{"id":tid}).mappings().first()
    return dict(row) if row else None
def list_tenders(page=1,page_size=20):
    with engine.connect() as con:
        total=con.execute(text("SELECT COUNT(*) FROM tenders")).scalar_one()
        rows=con.execute(text("SELECT id,filename,status,created_at FROM tenders ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),{"limit":page_size,"offset":(page-1)*page_size}).mappings().all()
    return {"items":[dict(r) for r in rows],"page":page,"page_size":page_size,"total":total,"total_pages":(total+page_size-1)//page_size}
def set_status(tid, status):
    with engine.begin() as con: con.execute(text("UPDATE tenders SET status=:status WHERE id=:id"),{"status":status,"id":tid})
def begin_analysis(tid):
    """Claim a tender for analysis without creating another tender record."""
    with engine.begin() as con:
        result=con.execute(text("UPDATE tenders SET status='processing' WHERE id=:id AND status <> 'processing'"),{"id":tid})
    return result.rowcount == 1
def save_analysis(tid, **output):
    payload={key:json.dumps(output[key]) for key in ("requirements","technical","pricing","quality","report")}; payload.update({"tender_id":tid,"updated_at":now()})
    with engine.begin() as con: con.execute(text("INSERT INTO analyses (tender_id,requirements,technical,pricing,quality,report,updated_at) VALUES (:tender_id,CAST(:requirements AS JSONB),CAST(:technical AS JSONB),CAST(:pricing AS JSONB),CAST(:quality AS JSONB),CAST(:report AS JSONB),:updated_at) ON CONFLICT (tender_id) DO UPDATE SET requirements=EXCLUDED.requirements,technical=EXCLUDED.technical,pricing=EXCLUDED.pricing,quality=EXCLUDED.quality,report=EXCLUDED.report,updated_at=EXCLUDED.updated_at"),payload)
def get_analysis(tid):
    with engine.connect() as con: row=con.execute(text("SELECT * FROM analyses WHERE tender_id=:id"),{"id":tid}).mappings().first()
    return dict(row) if row else None
def check_connection():
    with engine.connect() as con: return dict(con.execute(text("SELECT current_database() AS database, current_user AS user")).mappings().one())
def _rows(filename):
    path=settings.structured_dir/filename
    with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def seed_company_data():
    with engine.begin() as con:
      if not con.execute(text("SELECT 1 FROM product_catalog LIMIT 1")).first():
       for row in _rows("product_catalog.csv"): con.execute(text("INSERT INTO product_catalog VALUES (:sku,:name,CAST(:data AS JSONB),:source)"),{"sku":row["sku_id"],"name":row["product_name"],"data":json.dumps(row),"source":row.get("source_document")})
      if not con.execute(text("SELECT 1 FROM product_prices LIMIT 1")).first():
       for row in _rows("product_prices.csv"): con.execute(text("INSERT INTO product_prices VALUES (:sku,:name,:price,:unit,:currency)"),{"sku":row["sku_id"],"name":row["product_name"],"price":float(row["unit_price"]),"unit":row["price_unit"],"currency":row["currency"]})
      if not con.execute(text("SELECT 1 FROM testing_prices LIMIT 1")).first():
       for row in _rows("testing_prices.csv"): con.execute(text("INSERT INTO testing_prices VALUES (:id,:name,:price,:unit,:currency)"),{"id":row["test_id"],"name":row["test_name"],"price":float(row["price"]),"unit":row["charge_unit"],"currency":row["currency"]})
def products():
    with engine.connect() as con: return [dict(r["data"]) for r in con.execute(text("SELECT data FROM product_catalog WHERE active ORDER BY sku_id")).mappings()]
def product_prices():
    with engine.connect() as con:return [dict(r) for r in con.execute(text("SELECT sku_id,product_name,unit_price,price_unit,currency FROM product_prices WHERE active ORDER BY sku_id")).mappings()]
def testing_prices():
    with engine.connect() as con:return [dict(r) for r in con.execute(text("SELECT test_id,test_name,price,charge_unit,currency FROM testing_prices WHERE active ORDER BY test_id")).mappings()]
def _first(row, *keys):
    return next((row[key] for key in keys if row.get(key) not in (None, "")), None)
def _normalize_product_row(row):
    """Map supplier CSV column variants to the canonical matching schema."""
    normalized=dict(row)
    normalized.update({
        "category": _first(row,"category","product_category"),
        "armour": _first(row,"armour","armour_type","armor","armor_type"),
        "outer_sheath": _first(row,"outer_sheath","sheath_material","sheath","outer_sheath_material"),
        "standards": _first(row,"standards","standard","applicable_standard"),
        "source_document": _first(row,"source_document","datasheet_ref","datasheet_reference"),
    })
    return normalized
def import_products(rows):
    with engine.begin() as con:
      for row in rows:
       row=_normalize_product_row(row)
       if not row.get("sku_id") or not row.get("product_name"): raise ValueError("CSV requires sku_id and product_name")
       con.execute(text("INSERT INTO product_catalog VALUES (:sku,:name,CAST(:data AS JSONB),:source) ON CONFLICT (sku_id) DO UPDATE SET product_name=EXCLUDED.product_name,data=EXCLUDED.data,source_document=EXCLUDED.source_document"),{"sku":row["sku_id"],"name":row["product_name"],"data":json.dumps(row),"source":row.get("source_document")})
def import_product_prices(rows):
    with engine.begin() as con:
      for row in rows:
       if not row.get("sku_id") or not row.get("product_name") or row.get("unit_price") in (None,""): raise ValueError("Product price CSV requires sku_id, product_name and unit_price")
       con.execute(text("INSERT INTO product_prices VALUES (:sku,:name,:price,:unit,:currency) ON CONFLICT (sku_id) DO UPDATE SET product_name=EXCLUDED.product_name,unit_price=EXCLUDED.unit_price,price_unit=EXCLUDED.price_unit,currency=EXCLUDED.currency"),{"sku":row["sku_id"],"name":row["product_name"],"price":float(row["unit_price"]),"unit":row.get("price_unit") or "", "currency":row.get("currency") or ""})
def import_testing_prices(rows):
    with engine.begin() as con:
      for row in rows:
       if not row.get("test_id") or not row.get("test_name") or row.get("price") in (None,""): raise ValueError("Testing price CSV requires test_id, test_name and price")
       con.execute(text("INSERT INTO testing_prices VALUES (:id,:name,:price,:unit,:currency) ON CONFLICT (test_id) DO UPDATE SET test_name=EXCLUDED.test_name,price=EXCLUDED.price,charge_unit=EXCLUDED.charge_unit,currency=EXCLUDED.currency"),{"id":row["test_id"],"name":row["test_name"],"price":float(row["price"]),"unit":row.get("charge_unit") or "", "currency":row.get("currency") or ""})
def add_kb_document(doc_id,filename,key,extracted_text):
    with engine.begin() as con: con.execute(text("INSERT INTO knowledge_documents VALUES (:id,:filename,:key,:text,:created) ON CONFLICT (object_key) DO UPDATE SET extracted_text=EXCLUDED.extracted_text"),{"id":doc_id,"filename":filename,"key":key,"text":extracted_text,"created":now()})
def kb_documents():
    with engine.connect() as con:return [dict(r) for r in con.execute(text("SELECT * FROM knowledge_documents ORDER BY created_at")).mappings()]
