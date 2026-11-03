"""Provider boundary for Gemini; failures are surfaced instead of fabricated."""
from google import genai
from google.genai import types
import json
from app.config import settings
from app.schemas import TenderRequirements
from app.requirements import normalize_requirements

def verify_gemini() -> dict:
    if settings.llm_provider != "gemini":
        return {"provider": settings.llm_provider, "configured": False}
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(model=settings.gemini_model, contents="Reply with exactly: READY")
    if not getattr(response, "text", "").strip():
        raise RuntimeError("Gemini returned an empty response")
    return {"provider":"gemini","model":settings.gemini_model,"configured":True}

def extract_requirements(text: str) -> dict:
    if settings.llm_provider != "gemini": raise RuntimeError("Only the Gemini provider is enabled for production extraction")
    client=genai.Client(api_key=settings.gemini_api_key)
    prompt="""Extract tender requirements from the supplied document. Only use values explicitly supported by text; absent fields must be null or empty. Do not infer values. Preserve page/source references when present.

For every mandatory technical condition, populate the matching field on the relevant products entry as well as preserving the condition in mandatory_conditions. Do not leave a value only in mandatory_conditions. Include every explicitly named required test as a separate required_tests entry. Return JSON that satisfies this schema.

DOCUMENT:
"""+text[:120000]
    last=None
    for _ in range(2):
      try:
       response=client.models.generate_content(model=settings.gemini_model,contents=prompt,config=types.GenerateContentConfig(response_mime_type="application/json",response_json_schema=TenderRequirements.model_json_schema(),temperature=0))
       return normalize_requirements(json.loads(response.text))
      except Exception as exc: last=exc
    raise RuntimeError("Gemini requirement extraction failed") from last
def embed(texts:list[str]):
    if not settings.gemini_api_key: raise RuntimeError("GEMINI_API_KEY is not configured")
    client=genai.Client(api_key=settings.gemini_api_key); vectors=[]
    for value in texts:
      result=client.models.embed_content(model=settings.gemini_embedding_model,contents=value,config=types.EmbedContentConfig(output_dimensionality=settings.gemini_embedding_dim))
      vectors.append(result.embeddings[0].values)
    return vectors
