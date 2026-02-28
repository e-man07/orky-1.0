-- Add embedding column to chat_messages for RAG over chat history
ALTER TABLE "chat_messages" ADD COLUMN "embedding" vector(768);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_chat_messages_embedding_hnsw ON "chat_messages" USING hnsw ("embedding" vector_cosine_ops);
