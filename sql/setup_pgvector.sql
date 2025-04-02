-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for document embeddings
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding VECTOR(1536), -- 1536 dimensions for OpenAI ada-002 embeddings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create an index for faster similarity searches
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add has_embeddings column to files table if not exists
ALTER TABLE files ADD COLUMN IF NOT EXISTS has_embeddings BOOLEAN DEFAULT FALSE;

-- Function to search for similar documents
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  file_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc.id,
    doc.file_id,
    doc.content,
    doc.metadata,
    1 - (doc.embedding <=> query_embedding) AS similarity
  FROM document_embeddings doc
  WHERE 1 - (doc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- RLS Policies for document_embeddings table
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow public to read embeddings
CREATE POLICY "Public can read document embeddings"
  ON document_embeddings FOR SELECT
  USING (true);

-- Only service role can insert/update/delete embeddings
CREATE POLICY "Only service role can insert embeddings"
  ON document_embeddings FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update embeddings"
  ON document_embeddings FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete embeddings"
  ON document_embeddings FOR DELETE
  USING (auth.role() = 'service_role');