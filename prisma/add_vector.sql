CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE article_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON article_chunks USING hnsw (embedding vector_cosine_ops);
