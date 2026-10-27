"""
pgvector Vector Store Provider for DocuMind AI.

Implements enterprise-grade vector indexing using PostgreSQL with the pgvector extension.
Supports:
- HNSW (Hierarchical Navigable Small World) index for sub-millisecond approximate nearest neighbor search
- Native Cosine Distance operator (<=>)
- JSONB payload filtering and indexed relational attributes
- Automatic schema creation and connection pooling
"""

import json
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.documents import Document

try:
    from sqlalchemy import Column, Integer, String, Text, JSON, create_engine, text, select
    from sqlalchemy.orm import declarative_base, sessionmaker
    from pgvector.sqlalchemy import Vector
    PGVECTOR_CAPABLE = True
except ImportError:
    PGVECTOR_CAPABLE = False

from backend.config import (
    PGVECTOR_URL,
    PGVECTOR_TABLE,
    VECTOR_STORE_BACKEND,
)

logger = logging.getLogger(__name__)

if PGVECTOR_CAPABLE:
    Base = declarative_base()

    class DocumentModel(Base):
        __tablename__ = PGVECTOR_TABLE

        id = Column(String(255), primary_key=True)
        document_name = Column(String(255), index=True, nullable=False)
        source = Column(Text, nullable=True)
        page = Column(Integer, default=0, index=True)
        chunk_type = Column(String(50), default="text", index=True)
        content = Column(Text, nullable=False)
        metadata_json = Column(JSON, default=dict)
        embedding = Column(Vector(384))  # 384 dimensions for all-MiniLM-L6-v2
else:
    DocumentModel = None


class PGVectorStore:
    """
    Manages vector storage and similarity searches in PostgreSQL using pgvector.
    Provides sub-millisecond HNSW search with metadata payload filtering.
    """

    def __init__(self, connection_url: Optional[str] = None):
        self.connection_url = connection_url or PGVECTOR_URL
        self.engine = None
        self.SessionLocal = None
        self.embedding_function = None
        self.is_connected = False
        self._initialization_error = None

    def initialize(self, embedding_function=None) -> bool:
        """
        Initialize the pgvector connection, verify vector extension,
        and ensure table and HNSW indexes exist.
        """
        self.embedding_function = embedding_function

        if not PGVECTOR_CAPABLE:
            self._initialization_error = "SQLAlchemy or pgvector.sqlalchemy module not available"
            logger.warning(f"pgvector store unavailable: {self._initialization_error}")
            return False

        try:
            logger.info(f"Connecting to pgvector database at {self.connection_url}...")
            self.engine = create_engine(
                self.connection_url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                connect_args={"connect_timeout": 3},
            )

            # Test connection and ensure pgvector extension is created
            with self.engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()

            # Create tables
            Base.metadata.create_all(bind=self.engine)

            # Create HNSW vector index if not exists
            with self.engine.connect() as conn:
                conn.execute(text(f"""
                    CREATE INDEX IF NOT EXISTS {PGVECTOR_TABLE}_embedding_hnsw_idx
                    ON {PGVECTOR_TABLE} USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                """))
                conn.commit()

            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            self.is_connected = True
            logger.info(f"Successfully connected to pgvector! Table: '{PGVECTOR_TABLE}' with HNSW index.")
            return True

        except Exception as e:
            self.is_connected = False
            self._initialization_error = str(e)
            logger.warning(
                f"Could not connect to pgvector database ({e}). "
                "System will operate with local ChromaDB vector store."
            )
            return False

    def add_documents(
        self,
        documents: List[Document],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """Add documents and their dense vector embeddings to pgvector."""
        if not self.is_connected or not self.SessionLocal:
            raise RuntimeError("pgvector is not connected")

        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]

        # Calculate embeddings if function is present
        texts = [doc.page_content for doc in documents]
        if self.embedding_function:
            vectors = self.embedding_function.embed_documents(texts)
        else:
            vectors = [None] * len(documents)

        session = self.SessionLocal()
        try:
            for idx, doc in enumerate(documents):
                doc_id = ids[idx]
                meta = doc.metadata or {}
                source = meta.get("source", "")
                doc_name = meta.get("document_name") or (source.split("/")[-1] if source else "unknown")
                page = int(meta.get("page", 0))
                chunk_type = meta.get("chunk_type", "text")
                vec = vectors[idx]

                record = DocumentModel(
                    id=doc_id,
                    document_name=doc_name,
                    source=source,
                    page=page,
                    chunk_type=chunk_type,
                    content=doc.page_content,
                    metadata_json=meta,
                    embedding=vec,
                )
                session.merge(record)

            session.commit()
            logger.info(f"Inserted/updated {len(documents)} records in pgvector table '{PGVECTOR_TABLE}'.")
            return ids
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to add documents to pgvector: {e}")
            raise
        finally:
            session.close()

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_dict: Optional[Dict] = None,
    ) -> List[Tuple[Document, float]]:
        """
        Execute an approximate nearest-neighbor similarity search using
        pgvector's HNSW index and cosine distance operator (<=>).
        """
        if not self.is_connected or not self.SessionLocal:
            return []

        if not self.embedding_function:
            logger.warning("No embedding function configured for pgvector similarity search")
            return []

        query_embedding = self.embedding_function.embed_query(query)
        session = self.SessionLocal()

        try:
            # Cosine distance: 1 - cosine_similarity
            # Therefore similarity score = 1.0 - distance
            query_stmt = select(
                DocumentModel,
                DocumentModel.embedding.cosine_distance(query_embedding).label("distance"),
            )

            # Apply metadata filters
            if filter_dict:
                if "source" in filter_dict:
                    query_stmt = query_stmt.filter(DocumentModel.source == filter_dict["source"])
                if "document_name" in filter_dict:
                    query_stmt = query_stmt.filter(DocumentModel.document_name == filter_dict["document_name"])
                if "chunk_type" in filter_dict:
                    query_stmt = query_stmt.filter(DocumentModel.chunk_type == filter_dict["chunk_type"])
                if "page" in filter_dict:
                    query_stmt = query_stmt.filter(DocumentModel.page == int(filter_dict["page"]))

            query_stmt = query_stmt.order_by("distance").limit(k)
            rows = session.execute(query_stmt).all()

            results = []
            for doc_model, distance in rows:
                similarity = max(0.0, min(1.0, 1.0 - float(distance)))
                doc = Document(
                    page_content=doc_model.content,
                    metadata=doc_model.metadata_json or {},
                )
                results.append((doc, round(similarity, 4)))

            return results
        except Exception as e:
            logger.error(f"pgvector similarity search failed: {e}")
            return []
        finally:
            session.close()

    def get_document_chunks(self, document_name: str) -> List[Dict]:
        """Fetch all chunks for a specific document from pgvector."""
        if not self.is_connected or not self.SessionLocal:
            return []

        session = self.SessionLocal()
        try:
            rows = session.query(DocumentModel).filter(
                (DocumentModel.document_name == document_name) |
                (DocumentModel.source.like(f"%{document_name}"))
            ).order_by(DocumentModel.page.asc()).all()

            return [
                {
                    "id": row.id,
                    "content": row.content,
                    "metadata": row.metadata_json or {},
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error fetching document chunks from pgvector: {e}")
            return []
        finally:
            session.close()

    def get_all_chunks(self) -> List[Dict]:
        """Fetch all chunks across all documents."""
        if not self.is_connected or not self.SessionLocal:
            return []

        session = self.SessionLocal()
        try:
            rows = session.query(DocumentModel).all()
            return [
                {
                    "id": row.id,
                    "content": row.content,
                    "metadata": row.metadata_json or {},
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error fetching all chunks from pgvector: {e}")
            return []
        finally:
            session.close()

    def get_all_with_embeddings(self) -> Dict[str, List]:
        """Fetch all chunks and their vectors for 3D PCA Knowledge Map visualization."""
        if not self.is_connected or not self.SessionLocal:
            return {"embeddings": [], "metadatas": [], "documents": [], "ids": []}

        session = self.SessionLocal()
        try:
            rows = session.query(DocumentModel).all()
            embeddings = []
            metadatas = []
            documents = []
            ids = []

            for row in rows:
                if row.embedding is not None:
                    # Convert pgvector Vector object/list into float array
                    vec = list(row.embedding) if hasattr(row.embedding, "__iter__") else row.embedding
                    embeddings.append(vec)
                    metadatas.append(row.metadata_json or {})
                    documents.append(row.content)
                    ids.append(row.id)

            return {
                "embeddings": embeddings,
                "metadatas": metadatas,
                "documents": documents,
                "ids": ids,
            }
        except Exception as e:
            logger.error(f"Error fetching embeddings from pgvector: {e}")
            return {"embeddings": [], "metadatas": [], "documents": [], "ids": []}
        finally:
            session.close()

    def delete_document(self, document_name: str) -> int:
        """Delete all chunks for a document."""
        if not self.is_connected or not self.SessionLocal:
            return 0

        session = self.SessionLocal()
        try:
            deleted = session.query(DocumentModel).filter(
                (DocumentModel.document_name == document_name) |
                (DocumentModel.source.like(f"%{document_name}"))
            ).delete(synchronize_session=False)
            session.commit()
            return deleted
        except Exception as e:
            session.rollback()
            logger.error(f"Error deleting document from pgvector: {e}")
            return 0
        finally:
            session.close()

    def clear_all(self):
        """Truncate all records from pgvector table."""
        if not self.is_connected or not self.SessionLocal:
            return

        session = self.SessionLocal()
        try:
            session.query(DocumentModel).delete()
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error clearing pgvector: {e}")
            raise
        finally:
            session.close()
