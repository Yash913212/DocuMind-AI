"""
Unified Vector Database Management for DocuMind AI.

Supports:
- Supabase pgvector (Direct cloud PostgreSQL with HNSW indexing and visual Table Editor)
- Local PostgreSQL pgvector
- ChromaDB (Local filesystem fallback)
"""

import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings

from backend.config import (
    EMBEDDING_MODEL,
    CHROMA_DB_DIR,
    VECTOR_STORE_BACKEND,
    SUPABASE_URL,
    SUPABASE_KEY,
)
from backend.vectorstore.pgvector_store import PGVectorStore
from backend.vectorstore.supabase_store import SupabaseVectorStore

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Manages vector storage interactions for the RAG system.
    Routes between Supabase pgvector, local PostgreSQL pgvector, and ChromaDB.
    """

    def __init__(self):
        self.vectorstore: Optional[Chroma] = None
        self.supabase: Optional[SupabaseVectorStore] = None
        self.pgvector: Optional[PGVectorStore] = None
        self.embedding = None
        self.active_backend: str = "chroma"
        self._initialized = False

    def initialize(self):
        """Initialize embedding model and the active vector store."""
        if self._initialized:
            return

        logger.info(f"Initializing embedding model: {EMBEDDING_MODEL} (device: cpu)...")
        self.embedding = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={'device': 'cpu'},
        )

        connected = False

        # 1. Prioritize Supabase pgvector if credentials are configured
        if VECTOR_STORE_BACKEND in ("supabase", "pgvector") and SUPABASE_URL and SUPABASE_KEY:
            logger.info("Initializing Supabase pgvector cloud connection...")
            self.supabase = SupabaseVectorStore()
            connected = self.supabase.initialize(embedding_function=self.embedding)
            if connected:
                self.active_backend = "supabase"
                logger.info(">>> Active Vector Engine: Supabase pgvector (Cloud HNSW Index) <<<")

        # 2. Try direct PostgreSQL pgvector if Supabase is not active
        if not connected and VECTOR_STORE_BACKEND == "pgvector":
            logger.info("Attempting local PostgreSQL pgvector store initialization...")
            self.pgvector = PGVectorStore()
            connected = self.pgvector.initialize(embedding_function=self.embedding)
            if connected:
                self.active_backend = "pgvector"
                logger.info(">>> Active Vector Engine: pgvector (PostgreSQL with HNSW indexing) <<<")

        # 3. Fallback to ChromaDB
        if not connected:
            self.active_backend = "chroma"
            logger.info(">>> Active Vector Engine: ChromaDB (Local fallback) <<<")

        # Always initialize ChromaDB as local persistent backup
        logger.info(f"Connecting to ChromaDB store at {CHROMA_DB_DIR}...")
        self.vectorstore = Chroma(
            collection_name="documents",
            embedding_function=self.embedding,
            persist_directory=CHROMA_DB_DIR,
        )

        self._initialized = True
        logger.info(f"Vector Database Manager ready (Backend: {self.active_backend.upper()}).")

    def _get_active_store(self):
        if self.active_backend == "supabase" and self.supabase and self.supabase.is_connected:
            return self.supabase
        if self.active_backend == "pgvector" and self.pgvector and self.pgvector.is_connected:
            return self.pgvector
        return None

    def add_documents(self, documents: List[Document], ids: Optional[List[str]] = None) -> List[str]:
        """Add documents to the vectorstore with embeddings."""
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]

        active_store = self._get_active_store()
        if active_store:
            try:
                active_store.add_documents(documents, ids=ids)
            except Exception as e:
                logger.warning(f"Writing to {self.active_backend} failed: {e}. Writing to ChromaDB fallback.")

        # Always write to local ChromaDB for local redundancy
        self.vectorstore.add_documents(documents, ids=ids)
        return ids

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_dict: Optional[Dict] = None,
    ) -> List[Tuple[Document, float]]:
        """Search for similar documents with relevance scores."""
        active_store = self._get_active_store()
        if active_store:
            try:
                results = active_store.similarity_search(query, k=k, filter_dict=filter_dict)
                if results:
                    return results
            except Exception as e:
                logger.warning(f"{self.active_backend} search error: {e}. Falling back to ChromaDB.")

        kwargs = {"k": k}
        if filter_dict:
            kwargs["filter"] = filter_dict
        return self.vectorstore.similarity_search_with_relevance_scores(query, **kwargs)

    def get_all_documents_metadata(self) -> List[Dict]:
        """Get metadata for all stored documents."""
        try:
            results = self.vectorstore.get(include=["metadatas"])
            return results.get("metadatas", [])
        except Exception as e:
            logger.error(f"Error getting document metadata: {e}")
            return []

    def get_document_chunks(self, document_name: str) -> List[Dict]:
        """Get all chunks for a specific document."""
        active_store = self._get_active_store()
        if active_store:
            try:
                chunks = active_store.get_document_chunks(document_name)
                if chunks:
                    return chunks
            except Exception as e:
                logger.warning(f"{self.active_backend} get_document_chunks failed: {e}. Using ChromaDB.")

        try:
            results = self.vectorstore.get(include=["metadatas", "documents"])
            chunks = []
            metadatas = results.get("metadatas", [])
            documents = results.get("documents", [])
            ids = results.get("ids", [])

            for i, meta in enumerate(metadatas):
                if meta and (meta.get("source", "").endswith(document_name) or meta.get("document_name") == document_name):
                    chunks.append({
                        "id": ids[i],
                        "content": documents[i] if documents else "",
                        "metadata": meta,
                    })
            return chunks
        except Exception as e:
            logger.error(f"Error getting document chunks: {e}")
            return []

    def get_all_chunks(self) -> List[Dict]:
        """Get all indexed chunks without loading embeddings."""
        active_store = self._get_active_store()
        if active_store:
            try:
                chunks = active_store.get_all_chunks()
                if chunks:
                    return chunks
            except Exception as e:
                logger.warning(f"{self.active_backend} get_all_chunks failed: {e}. Using ChromaDB.")

        try:
            results = self.vectorstore.get(include=["metadatas", "documents"])
            metadatas = results.get("metadatas", [])
            documents = results.get("documents", [])
            ids = results.get("ids", [])
            return [
                {
                    "id": ids[i],
                    "content": documents[i] if documents else "",
                    "metadata": metadatas[i] if metadatas else {},
                }
                for i in range(len(ids))
            ]
        except Exception as e:
            logger.error(f"Error getting chunks: {e}")
            return []

    def get_all_with_embeddings(self) -> Dict[str, List]:
        """Get all documents with their embeddings for 3D PCA visualization."""
        active_store = self._get_active_store()
        if active_store:
            try:
                data = active_store.get_all_with_embeddings()
                if data and data.get("embeddings"):
                    return data
            except Exception as e:
                logger.warning(f"{self.active_backend} get_all_with_embeddings failed: {e}. Using ChromaDB.")

        try:
            results = self.vectorstore.get(include=["embeddings", "metadatas", "documents"])
            return {
                "embeddings": results.get("embeddings", []),
                "metadatas": results.get("metadatas", []),
                "documents": results.get("documents", []),
                "ids": results.get("ids", []),
            }
        except Exception as e:
            logger.error(f"Error getting embeddings: {e}")
            return {"embeddings": [], "metadatas": [], "documents": [], "ids": []}

    def delete_document(self, document_name: str) -> int:
        """Delete all chunks for a document. Returns count of deleted chunks."""
        deleted = 0
        active_store = self._get_active_store()
        if active_store:
            try:
                deleted = active_store.delete_document(document_name)
            except Exception as e:
                logger.warning(f"{self.active_backend} delete_document failed: {e}")

        try:
            results = self.vectorstore.get(include=["metadatas"])
            ids_to_delete = []
            metadatas = results.get("metadatas", [])
            ids = results.get("ids", [])

            for i, meta in enumerate(metadatas):
                if meta and (meta.get("source", "").endswith(document_name) or meta.get("document_name") == document_name):
                    ids_to_delete.append(ids[i])

            if ids_to_delete:
                self.vectorstore.delete(ids=ids_to_delete)
                if deleted == 0:
                    deleted = len(ids_to_delete)
        except Exception as e:
            logger.error(f"Error deleting document from ChromaDB: {e}")
        return deleted

    def clear_all(self):
        """Delete all documents from the database."""
        active_store = self._get_active_store()
        if active_store:
            try:
                active_store.clear_all()
            except Exception as e:
                logger.warning(f"{self.active_backend} clear_all failed: {e}")

        try:
            results = self.vectorstore.get(include=[])
            ids = results.get("ids", [])
            if ids:
                self.vectorstore.delete(ids=ids)
        except Exception as e:
            logger.error(f"Error clearing database: {e}")
            raise

    def store_visual_page(
        self,
        document_name: str,
        page_number: int,
        image_path: str,
        description: str,
        metadata: Dict[str, Any],
    ):
        """Store a visual page representation for multimodal retrieval."""
        doc = Document(
            page_content=f"[Visual Page Description - Page {page_number}]\n{description}",
            metadata={
                "source": metadata.get("source", ""),
                "page": page_number,
                "chunk_type": "visual_page",
                "image_path": image_path,
                "document_name": document_name,
                **{k: v for k, v in metadata.items() if k not in ("source", "page")},
            },
        )
        self.add_documents([doc])

    def store_table_chunk(
        self,
        document_name: str,
        page_number: int,
        table_text: str,
        table_metadata: Dict[str, Any],
    ):
        """Store a table as a dedicated retrieval chunk."""
        doc = Document(
            page_content=table_text,
            metadata={
                "source": table_metadata.get("source", ""),
                "page": page_number,
                "chunk_type": "table",
                "document_name": document_name,
                **{k: v for k, v in table_metadata.items() if k not in ("source", "page")},
            },
        )
        self.add_documents([doc])

    def store_figure_chunk(
        self,
        document_name: str,
        page_number: int,
        figure_text: str,
        figure_metadata: Dict[str, Any],
    ):
        """Store a figure/diagram description as a dedicated retrieval chunk."""
        doc = Document(
            page_content=figure_text,
            metadata={
                "source": figure_metadata.get("source", ""),
                "page": page_number,
                "chunk_type": "figure",
                "document_name": document_name,
                **{k: v for k, v in figure_metadata.items() if k not in ("source", "page")},
            },
        )
        self.add_documents([doc])


# Module-level singleton
db_manager = DatabaseManager()
