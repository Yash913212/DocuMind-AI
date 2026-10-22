"""
ChromaDB database operations for the multimodal RAG system.
Handles vectorstore initialization, document storage, and visual page management.
"""

import json
import logging
import uuid
import os
from typing import Any, Dict, List, Optional, Tuple

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings

from backend.config import (
    EMBEDDING_MODEL,
    CHROMA_DB_DIR,
)

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages all ChromaDB interactions for the RAG system."""

    def __init__(self):
        self.vectorstore: Optional[Chroma] = None
        self.embedding = None
        self._initialized = False

    def initialize(self):
        """Initialize ChromaDB vectorstore."""
        if self._initialized:
            return

        logger.info("Initializing ChromaDB connection...")
        logger.info(f"Using local CPU embeddings with lightweight model: {EMBEDDING_MODEL}")
        self.embedding = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={'device': 'cpu'}
        )

        self.vectorstore = Chroma(
            collection_name="documents",
            embedding_function=self.embedding,
            persist_directory=CHROMA_DB_DIR,
        )

        self._initialized = True
        logger.info("ChromaDB connection initialized.")

    def add_documents(self, documents: List[Document], ids: Optional[List[str]] = None) -> List[str]:
        """Add documents to the vectorstore with embeddings."""
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]
        self.vectorstore.add_documents(documents, ids=ids)
        return ids

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_dict: Optional[Dict] = None,
    ) -> List[Tuple[Document, float]]:
        """Search for similar documents with relevance scores."""
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
                        "metadata": meta
                    })
            return chunks
        except Exception as e:
            logger.error(f"Error getting document chunks: {e}")
            return []

    def get_all_chunks(self) -> List[Dict]:
        """Get all indexed chunks without loading embeddings."""
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
        """Get all documents with their embeddings for visualization."""
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
                deleted = len(ids_to_delete)
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
        return deleted

    def clear_all(self):
        """Delete all documents from the database."""
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
