"""
Centralized configuration for the Multimodal RAG system.
All settings are loaded from environment variables with sensible defaults.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Directory Paths ──
DATA_DIR = os.environ.get("DATA_DIR", "./data")
PAGE_IMAGES_DIR = os.path.join(DATA_DIR, "page_images")
EXTRACTED_IMAGES_DIR = os.path.join(DATA_DIR, "extracted_images")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PAGE_IMAGES_DIR, exist_ok=True)
os.makedirs(EXTRACTED_IMAGES_DIR, exist_ok=True)

# ── Upload Limits ──
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "50"))

# ── Chunking ──
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "50"))

# ── Retrieval ──
RETRIEVAL_K = int(os.environ.get("TOP_K", "5"))
RERANK_TOP_K = int(os.environ.get("RERANK_TOP_K", "5"))

# ── Feature Flags ──
ENABLE_VISUAL_RETRIEVAL = os.environ.get("ENABLE_VISUAL_RETRIEVAL", "true").lower() == "true"
ENABLE_TABLE_RETRIEVAL = os.environ.get("ENABLE_TABLE_RETRIEVAL", "true").lower() == "true"
ENABLE_DIAGRAM_ANALYSIS = os.environ.get("ENABLE_DIAGRAM_ANALYSIS", "true").lower() == "true"
ENABLE_TECHNICAL_MODE = os.environ.get("ENABLE_TECHNICAL_MODE", "true").lower() == "true"

# ── API Keys ──
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# ── Model Configuration ──
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
VISION_MODEL = os.environ.get("VISION_MODEL", "moondream:latest")
VISUAL_EMBEDDING_MODEL = os.environ.get("VISUAL_EMBEDDING_MODEL", "clip-ViT-B-32")
LLM_PRIMARY = os.environ.get("LLM_PRIMARY", "llama3.2:latest")
LLM_FALLBACK_1 = os.environ.get("LLM_FALLBACK_1", "openai/gpt-oss-120b")
LLM_FALLBACK_2 = os.environ.get("LLM_FALLBACK_2", "openai/gpt-oss-20b")
USE_ONLY_OLLAMA = os.environ.get("USE_ONLY_OLLAMA", "true").lower() == "true"

# ── ChromaDB Configuration ──
CHROMA_DB_DIR = os.path.join(DATA_DIR, "chroma_db")
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

# ── Model Keep Alive ──
_keep_alive = os.environ.get("MODEL_KEEP_ALIVE", "0")
try:
    MODEL_KEEP_ALIVE = int(_keep_alive)
except ValueError:
    MODEL_KEEP_ALIVE = _keep_alive

# ── CORS ──
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

# ── PDF Processing Settings ──
PAGE_IMAGE_DPI = int(os.environ.get("PAGE_IMAGE_DPI", "150"))
MAX_IMAGE_DIMENSION = int(os.environ.get("MAX_IMAGE_DIMENSION", "1024"))

# ── Privacy Mode (runtime toggle) ──
# "normal" = full cloud + local, "private" = local-only
_current_mode = os.environ.get("DEFAULT_MODE", "normal")


def get_privacy_mode() -> str:
    """Get current privacy mode: 'normal' or 'private'."""
    return _current_mode


def set_privacy_mode(mode: str):
    """Set privacy mode at runtime."""
    global _current_mode
    if mode not in ("normal", "private"):
        raise ValueError(f"Invalid mode: {mode}. Must be 'normal' or 'private'.")
    _current_mode = mode


def is_private_mode() -> bool:
    """Check if private mode is active."""
    return _current_mode == "private"
