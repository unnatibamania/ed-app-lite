-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create files table with reference to folders
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT,
  path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Index for faster lookup by folder
  CONSTRAINT fk_folder FOREIGN KEY (folder_id) REFERENCES folders(id)
);

-- Create index on folder_id for faster queries
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- Enable Row Level Security 
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (for demo purposes)
-- In a production app, you would want to restrict this to authenticated users
CREATE POLICY "Allow anonymous insert" ON folders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous select" ON folders FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert" ON files FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous select" ON files FOR SELECT TO anon USING (true);

-- Create storage bucket for files if it doesn't exist
-- Note: This is typically done in the Supabase dashboard, but including here for documentation
-- INSERT INTO storage.buckets (id, name) VALUES ('files', 'files')
-- ON CONFLICT DO NOTHING; 