#!/usr/bin/env python3
"""
Migration Utility: ChromaDB -> pgvector (Supabase or Local PostgreSQL)

Copies all existing document chunks, embeddings, and JSON metadata from local ChromaDB
directly into your pgvector database (Supabase or PostgreSQL).
"""

import sys
import os
import logging
from typing import List

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from langchain_core.documents import Document
from backend.config import (
    CHROMA_DB_DIR,
    PGVECTOR_URL,
    SUPABASE_URL,
    SUPABASE_KEY,
)
from backend.database import db_manager
from backend.vectorstore.pgvector_store import PGVectorStore
from backend.vectorstore.supabase_store import SupabaseVectorStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pgvector-migrator")


def migrate():
    logger.info("Initializing migration from ChromaDB to pgvector...")
    db_manager.initialize()

    # Get all chunks from ChromaDB
    chroma_data = db_manager.get_all_with_embeddings()
    ids = chroma_data.get("ids", [])
    documents = chroma_data.get("documents", [])
    metadatas = chroma_data.get("metadatas", [])
    embeddings = chroma_data.get("embeddings", [])

    total = len(ids)
    if total == 0:
        logger.warning(f"No existing chunks found in ChromaDB at {CHROMA_DB_DIR}. Nothing to migrate.")
        return

    logger.info(f"Found {total} chunks in ChromaDB.")

    # Choose target store based on configured credentials
    if SUPABASE_URL and SUPABASE_KEY:
        logger.info(f"Target Store: Supabase pgvector ({SUPABASE_URL})")
        target_store = SupabaseVectorStore()
        connected = target_store.initialize(embedding_function=db_manager.embedding)
        store_name = "Supabase pgvector"
    else:
        logger.info(f"Target Store: Local PostgreSQL pgvector ({PGVECTOR_URL})")
        target_store = PGVectorStore(PGVECTOR_URL)
        connected = target_store.initialize(embedding_function=db_manager.embedding)
        store_name = "PostgreSQL pgvector"

    if not connected:
        logger.error(
            f"Could not connect to {store_name}.\n"
            "Ensure your SUPABASE_URL / SUPABASE_KEY or PGVECTOR_URL is correctly configured in .env."
        )
        sys.exit(1)

    logger.info(f"Migrating {total} records to {store_name} in batches of 50...")
    batch_size = 50
    migrated_count = 0

    for i in range(0, total, batch_size):
        end_idx = min(i + batch_size, total)
        batch_ids = ids[i:end_idx]
        batch_docs = [
            Document(page_content=documents[j], metadata=metadatas[j])
            for j in range(i, end_idx)
        ]
        batch_embs = [
            embeddings[j] for j in range(i, end_idx)
        ] if embeddings is not None and len(embeddings) >= end_idx else None

        target_store.add_documents(batch_docs, ids=batch_ids, embeddings=batch_embs)
        migrated_count += len(batch_ids)
        logger.info(f"Progress: [{migrated_count}/{total}] chunks migrated ({(migrated_count/total)*100:.1f}%)")

    logger.info(f"✅ Successfully migrated {migrated_count} records to {store_name}!")
    logger.info("Open your Supabase Table Editor at https://supabase.com to view all chunks and vector embeddings.")


if __name__ == "__main__":
    migrate()
