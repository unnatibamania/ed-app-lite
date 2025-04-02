export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface FileRecord {
  id: string;
  folder_id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  created_at: string;
  updated_at?: string;
  has_embeddings?: boolean;
}

export interface UploadResult {
  folderId: string;
  fileIds: string[];
  success: boolean;
  embeddingQueued?: boolean;
}

// Vector embedding interfaces
export interface DocumentChunk {
  id: string;
  file_id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
  created_at: string;
}

export interface ChunkMetadata {
  file_name: string;
  file_type: string;
  chunk_index: number;
  total_chunks: number;
  folder_id?: string;
  page_number?: number;
}
