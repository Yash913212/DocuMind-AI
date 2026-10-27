"""
api.py — Root Server Entry Point for DocuMind AI.

The complete backend architecture is modularized in the `/backend` package.
All FastAPI endpoints, middleware, and streaming handlers reside in:
  backend/api.py

This root file cleanly exposes `app` to maintain complete backward compatibility with:
  uvicorn api:app --reload
  uvicorn backend.api:app --reload
  python api.py
"""

from backend.api import app, ensure_rag_ready

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=8000, reload=True)
