"""Persistent FAISS index backed by Gemini Embedding 2 and PostgreSQL metadata."""
import json, re
from pathlib import Path
import numpy as np
from app.config import settings
from app.database import kb_documents
from app.llm import embed

INDEX=settings.faiss_dir/"products.faiss"; META=settings.faiss_dir/"products.json"
def _faiss():
    # Keep non-RAG API operations (including tender re-analysis setup) usable
    # on environments where the optional FAISS native library is unavailable.
    import faiss
    return faiss
def chunks(text,size=1200,overlap=150):
    return [text[i:i+size] for i in range(0,len(text),size-overlap) if text[i:i+size].strip()]
def _chunk_records(document):
    text=document["extracted_text"]
    records=[]
    for number,start in enumerate(range(0,len(text),1200-150)):
      chunk=text[start:start+1200]
      if not chunk.strip(): continue
      pages=re.findall(r"\[Page\s+(\d+)\]",text[:start+1],re.I)
      records.append({"filename":document["filename"],"object_key":document["object_key"],"chunk_number":number,"page_number":int(pages[-1]) if pages else None,"text":chunk})
    return records
def _lexical_retrieve(query, records, top_k):
    query_terms=set(re.findall(r"[a-z0-9]+", query.lower()))
    ranked=[]
    for record in records:
        terms=set(re.findall(r"[a-z0-9]+", record["text"].lower()))
        score=len(query_terms & terms)
        if score: ranked.append({**record,"score":float(score),"retrieval_method":"lexical_fallback"})
    return sorted(ranked,key=lambda record:record["score"],reverse=True)[:top_k]
def rebuild():
    docs=kb_documents(); records=[]
    for doc in docs: records.extend(_chunk_records(doc))
    if not records: raise RuntimeError("No datasheets have been ingested")
    settings.faiss_dir.mkdir(parents=True,exist_ok=True)
    META.write_text(json.dumps({"embedding_model":settings.gemini_embedding_model,"dimension":settings.gemini_embedding_dim,"records":records}),encoding="utf-8")
    try:
      vectors=embed([f"title: {r['filename']} | text: {r['text']}" for r in records])
      faiss=_faiss(); matrix=np.asarray(vectors,dtype="float32"); faiss.normalize_L2(matrix); index=faiss.IndexFlatIP(settings.gemini_embedding_dim); index.add(matrix)
      faiss.write_index(index,str(INDEX))
      return {"documents":len(docs),"chunks":len(records),"ready":True,"dimension":settings.gemini_embedding_dim,"retrieval_method":"faiss"}
    except (ImportError, OSError):
      # Keep document evidence usable when an optional native FAISS wheel is
      # unavailable in a local environment.
      if INDEX.exists(): INDEX.unlink()
      return {"documents":len(docs),"chunks":len(records),"ready":False,"dimension":settings.gemini_embedding_dim,"retrieval_method":"lexical_fallback"}
def retrieve(query,top_k=5,question=False):
    if not META.exists(): return []
    metadata=json.loads(META.read_text(encoding="utf-8"))
    if metadata["embedding_model"]!=settings.gemini_embedding_model or metadata["dimension"]!=settings.gemini_embedding_dim: raise RuntimeError("Embedding configuration changed; rebuild the knowledge base")
    if not INDEX.exists(): return _lexical_retrieve(query,metadata["records"],top_k)
    try:
      faiss=_faiss(); vector=np.asarray(embed([f"task: {'question answering' if question else 'search result'} | query: {query}"])[0],dtype="float32").reshape(1,-1); faiss.normalize_L2(vector); scores,ids=faiss.read_index(str(INDEX)).search(vector,top_k)
      return [{**metadata["records"][idx],"score":float(scores[0][n]),"retrieval_method":"faiss"} for n,idx in enumerate(ids[0]) if idx>=0]
    except (ImportError, OSError):
      return _lexical_retrieve(query,metadata["records"],top_k)
def status():
    if not META.exists(): return {"ready":False,"documents":0,"chunks":0}
    meta=json.loads(META.read_text(encoding="utf-8")); return {"ready":INDEX.exists(),"documents":len({r['object_key'] for r in meta['records']}),"chunks":len(meta['records']),"embedding_model":meta['embedding_model'],"dimension":meta['dimension']}
