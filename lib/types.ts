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
}

export interface UploadResult {
  folderId: string;
  fileIds: string[];
  success: boolean;
}
