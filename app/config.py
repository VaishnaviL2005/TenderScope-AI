from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

# Local development uses this project's git-ignored .env. Production should inject
# the same values via its runtime environment and not ship a .env file.
load_dotenv(override=True)

@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.getenv("DATA_DIR", "data"))
    database_url: str = os.getenv("DATABASE_URL", "")
    max_upload_size_mb: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    gemini_embedding_model: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
    gemini_embedding_dim: int = int(os.getenv("GEMINI_EMBEDDING_DIM", os.getenv("EMBEDDING_DIMENSIONS", "768")))
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    storage_backend: str = os.getenv("STORAGE_BACKEND", "neon_s3")
    storage_bucket: str = os.getenv("NEON_STORAGE_BUCKET", "assets")
    @property
    def sqlalchemy_database_url(self) -> str:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is required; run `neon env pull` or configure .env")
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    @property
    def uploads_dir(self) -> Path: return self.data_dir / "uploads"
    @property
    def kb_dir(self) -> Path: return self.data_dir / "product_datasheets"
    @property
    def structured_dir(self) -> Path: return self.data_dir / "structured_data"
    @property
    def faiss_dir(self) -> Path: return Path(os.getenv("FAISS_INDEX_DIR", str(self.data_dir / "faiss_index")))

settings = Settings()
for directory in (settings.data_dir, settings.uploads_dir, settings.kb_dir, settings.structured_dir, settings.data_dir / "faiss_index"):
    directory.mkdir(parents=True, exist_ok=True)
