"use client";

import { useState } from "react";
import FileUploader from "./components/FileUploader";

export default function Home() {
  const [uploadComplete, setUploadComplete] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleUploadComplete = (folderId: string, files: File[]) => {
    setFolderId(folderId);
    setUploadedFiles(files);
    setUploadComplete(true);
  };

  return (
    <div className="flex flex-col min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">File Storage App</h1>

      {!uploadComplete ? (
        <div className="flex-1">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              Upload multiple files to a single folder. The files will be stored
              in Supabase storage and linked to a folder entry in the database.
            </p>
          </div>
          <FileUploader onUploadComplete={handleUploadComplete} />
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-green-800 mb-2">
            Upload Complete!
          </h2>
          <p className="text-green-700 mb-4">
            All files have been successfully uploaded and linked to folder ID:{" "}
            <span className="font-mono bg-green-100 px-2 py-1 rounded">
              {folderId}
            </span>
          </p>
          <p className="text-green-700 mb-2">
            Uploaded {uploadedFiles.length} files:
          </p>
          <ul className="list-disc pl-5 text-green-700">
            {uploadedFiles.map((file, index) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
          <button
            onClick={() => setUploadComplete(false)}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
          >
            Upload More Files
          </button>
        </div>
      )}
    </div>
  );
}
