-- DocuMind AI pgvector Schema Initialization
-- High-performance HNSW index on 384-dimensional vector embeddings with JSONB payload filtering

CREATE EXTENSION IF NOT EXISTS vector;

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(255) PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL,
    source TEXT,
    page INTEGER DEFAULT 0,
    chunk_type VARCHAR(50) DEFAULT 'text',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index for Sub-Millisecond Cosine Similarity Search
-- m = 16 (number of bidirectional links), ef_construction = 64 (construction search depth)
CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx 
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Relational & Payload B-Tree / GIN Indexes for Filtered Queries
CREATE INDEX IF NOT EXISTS documents_document_name_idx ON documents (document_name);
CREATE INDEX IF NOT EXISTS documents_chunk_type_idx ON documents (chunk_type);
CREATE INDEX IF NOT EXISTS documents_page_idx ON documents (page);
CREATE INDEX IF NOT EXISTS documents_metadata_gin_idx ON documents USING gin (metadata);
