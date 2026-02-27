-- Drop old HNSW index
DROP INDEX IF EXISTS idx_chunks_embedding_hnsw;

-- Change vector dimension from 768 to 3072
ALTER TABLE article_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE article_chunks ADD COLUMN embedding vector(3072);

-- Use IVFFlat index instead (HNSW has 2000 dim limit on Neon)
-- For small datasets we skip the index; exact search is fast enough
-- CREATE INDEX idx_chunks_embedding_ivfflat ON article_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
