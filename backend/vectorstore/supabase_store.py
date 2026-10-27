"""
Supabase pgvector Vector Store Provider for DocuMind AI.

Direct cloud pgvector storage using the official Supabase client:
- Secure HTTPS REST communication (no firewall / port 5432 configuration required)
- Sub-millisecond HNSW cosine similarity search via pgvector
- Seamless browser visibility in Supabase Table Editor
"""

import json
import logging
import math
import uuid
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.documents import Document

try:
    from supabase import create_client, Client
    SUPABASE_CLIENT_AVAILABLE = True
except ImportError:
    SUPABASE_CLIENT_AVAILABLE = False

from backend.config import (
    SUPABASE_URL,
    SUPABASE_KEY,
)

logger = logging.getLogger(__name__)


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Fallback cosine similarity computation."""
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm1 * norm2)))
def _clean_pg_text(val):
    """Sanitize strings for PostgreSQL to eliminate unsupported null byte escape sequences."""
    if isinstance(val, str):
        return val.replace("\x00", "").replace("\u0000", "")
    elif isinstance(val, dict):
        return {k: _clean_pg_text(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_clean_pg_text(x) for x in val]
    return val



class SupabaseVectorStore:
    """
    Manages vector storage and similarity searches in Supabase PostgreSQL using pgvector.
    Provides instant visibility in the Supabase Table Editor.
    """

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        self.url = url or SUPABASE_URL
        self.key = key or SUPABASE_KEY
        self.client: Optional[Client] = None
        self.embedding_function = None
        self.is_connected = False
        self._has_rpc = False

    def initialize(self, embedding_function=None) -> bool:
        """Initialize connection to Supabase and verify pgvector table."""
        self.embedding_function = embedding_function

        if not SUPABASE_CLIENT_AVAILABLE:
            logger.warning("supabase-py library not installed.")
            return False

        if not self.url or not self.key:
            logger.warning("Supabase URL or Key not configured.")
            return False

        try:
            logger.info(f"Connecting to Supabase project at {self.url}...")
            self.client = create_client(self.url, self.key)

            # Probe documents table
            res = self.client.table("documents").select("id").limit(1).execute()
            self.is_connected = True

            # Probe if match_documents RPC exists
            try:
                self.client.rpc("match_documents", {"query_embedding": [0.0] * 384, "match_count": 1}).execute()
                self._has_rpc = True
            except Exception:
                self._has_rpc = False

            logger.info(
                f"Successfully connected to Supabase pgvector! "
                f"Table 'documents' accessible. (Native RPC Search: {self._has_rpc})"
            )
            return True

        except Exception as e:
            self.is_connected = False
            logger.warning(
                f"Could not connect to Supabase pgvector ({e}). "
                "System will operate with local ChromaDB vector store."
            )
            return False

    def add_documents(
        self,
        documents: List[Document],
        ids: Optional[List[str]] = None,
        embeddings: Optional[List[List[float]]] = None,
    ) -> List[str]:
        """Add documents and their 384D dense vector embeddings to Supabase."""
        if not self.is_connected or not self.client:
            raise RuntimeError("Supabase pgvector is not connected")

        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]

        if embeddings is not None and len(embeddings) == len(documents):
            vectors = embeddings
        elif self.embedding_function:
            texts = [doc.page_content for doc in documents]
            vectors = self.embedding_function.embed_documents(texts)
        else:
            vectors = [None] * len(documents)

        records = []
        for idx, doc in enumerate(documents):
            meta = doc.metadata or {}
            source = meta.get("source", "")
            doc_name = meta.get("document_name") or (source.split("/")[-1] if source else "unknown")
            page = int(meta.get("page", 0))
            chunk_type = meta.get("chunk_type", "text")
            vec = vectors[idx]
            if vec is not None and hasattr(vec, "tolist"):
                vec = vec.tolist()

            records.append({
                "id": str(ids[idx]),
                "document_name": _clean_pg_text(doc_name),
                "source": _clean_pg_text(source),
                "page": page,
                "chunk_type": chunk_type,
                "content": _clean_pg_text(doc.page_content),
                "metadata": _clean_pg_text(meta),
                "embedding": vec,
            })

        # Batch upsert in chunks of 50 to respect payload limits
        batch_size = 50
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            self.client.table("documents").upsert(batch).execute()

        logger.info(f"Successfully upserted {len(documents)} records to Supabase pgvector 'documents' table.")
        return ids

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_dict: Optional[Dict] = None,
    ) -> List[Tuple[Document, float]]:
        """Search for similar documents using pgvector cosine similarity."""
        if not self.is_connected or not self.client or not self.embedding_function:
            return []

        query_embedding = self.embedding_function.embed_query(query)

        # 1. Use native pgvector RPC if available in Supabase
        if self._has_rpc:
            try:
                rpc_params = {
                    "query_embedding": query_embedding,
                    "match_count": k,
                }
                if filter_dict and "source" in filter_dict:
                    rpc_params["filter_source"] = filter_dict["source"]
                if filter_dict and "chunk_type" in filter_dict:
                    rpc_params["filter_chunk_type"] = filter_dict["chunk_type"]

                res = self.client.rpc("match_documents", rpc_params).execute()
                results = []
                for row in (res.data or []):
                    doc = Document(
                        page_content=row["content"],
                        metadata=row.get("metadata") or {},
                    )
                    results.append((doc, round(float(row.get("similarity", 0.0)), 4)))
                if results:
                    return results
            except Exception as e:
                logger.debug(f"Supabase RPC match failed, using fallback query: {e}")

        # 2. Resilient Direct Table Query + Vector Cosine Ranking
        try:
            builder = self.client.table("documents").select("id, content, metadata, embedding")
            if filter_dict:
                if "source" in filter_dict:
                    builder = builder.eq("source", filter_dict["source"])
                if "document_name" in filter_dict:
                    builder = builder.eq("document_name", filter_dict["document_name"])
                if "chunk_type" in filter_dict:
                    builder = builder.eq("chunk_type", filter_dict["chunk_type"])

            res = builder.limit(100).execute()
            rows = res.data or []

            scored = []
            for row in rows:
                raw_emb = row.get("embedding")
                if not raw_emb:
                    continue
                # Handle stringified vector from json
                if isinstance(raw_emb, str):
                    try:
                        emb = json.loads(raw_emb)
                    except Exception:
                        continue
                else:
                    emb = raw_emb

                sim = _cosine_similarity(query_embedding, emb)
                doc = Document(
                    page_content=row["content"],
                    metadata=row.get("metadata") or {},
                )
                scored.append((doc, round(sim, 4)))

            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:k]

        except Exception as e:
            logger.error(f"Supabase similarity search failed: {e}")
            return []

    def get_document_chunks(self, document_name: str) -> List[Dict]:
        """Fetch all chunks for a specific document from Supabase."""
        if not self.is_connected or not self.client:
            return []

        try:
            res = self.client.table("documents").select(
                "id, content, metadata, page"
            ).or_(
                f"document_name.eq.{document_name},source.ilike.%{document_name}%"
            ).order("page").execute()

            return [
                {
                    "id": row["id"],
                    "content": row["content"],
                    "metadata": row.get("metadata") or {},
                }
                for row in (res.data or [])
            ]
        except Exception as e:
            logger.error(f"Error fetching document chunks from Supabase: {e}")
            return []

    def get_all_chunks(self) -> List[Dict]:
        """Fetch all chunks from Supabase."""
        if not self.is_connected or not self.client:
            return []

        try:
            res = self.client.table("documents").select("id, content, metadata").execute()
            return [
                {
                    "id": row["id"],
                    "content": row["content"],
                    "metadata": row.get("metadata") or {},
                }
                for row in (res.data or [])
            ]
        except Exception as e:
            logger.error(f"Error fetching all chunks from Supabase: {e}")
            return []

    def get_all_with_embeddings(self) -> Dict[str, List]:
        """Fetch all documents and embeddings for the 3D PCA Knowledge Map."""
        if not self.is_connected or not self.client:
            return {"embeddings": [], "metadatas": [], "documents": [], "ids": []}

        try:
            res = self.client.table("documents").select("id, content, metadata, embedding").execute()
            embeddings = []
            metadatas = []
            documents = []
            ids = []

            for row in (res.data or []):
                raw_emb = row.get("embedding")
                if raw_emb:
                    if isinstance(raw_emb, str):
                        emb = json.loads(raw_emb)
                    else:
                        emb = raw_emb
                    embeddings.append(emb)
                    metadatas.append(row.get("metadata") or {})
                    documents.append(row["content"])
                    ids.append(row["id"])

            return {
                "embeddings": embeddings,
                "metadatas": metadatas,
                "documents": documents,
                "ids": ids,
            }
        except Exception as e:
            logger.error(f"Error fetching embeddings from Supabase: {e}")
            return {"embeddings": [], "metadatas": [], "documents": [], "ids": []}

    def delete_document(self, document_name: str) -> int:
        """Delete all chunks for a document from Supabase."""
        if not self.is_connected or not self.client:
            return 0

        try:
            res = self.client.table("documents").delete().or_(
                f"document_name.eq.{document_name},source.ilike.%{document_name}%"
            ).execute()
            return len(res.data or [])
        except Exception as e:
            logger.error(f"Error deleting document from Supabase: {e}")
            return 0

    def clear_all(self):
        """Truncate all documents from Supabase."""
        if not self.is_connected or not self.client:
            return

        try:
            self.client.table("documents").delete().neq("id", "___none___").execute()
            logger.info("Cleared all records from Supabase documents table.")
        except Exception as e:
            logger.error(f"Error clearing Supabase: {e}")
            raise
