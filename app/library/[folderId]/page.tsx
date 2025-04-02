"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation"; // Hook to get route params
import { FileRecord, Folder } from "@/lib/types"; // Using FileRecord type
import Link from "next/link";
import { DocumentIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

// Helper function to get a simple file type description
const getFileTypeDescription = (
  mimeType: string | undefined | null
): string => {
  if (!mimeType) return "Unknown";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("text/")) return "Text";
  if (mimeType.includes("word")) return "Word Document";
  // Add more mappings as needed
  return mimeType.split("/")[1] || mimeType; // Fallback
};

export default function FolderDetailPage() {
  const params = useParams();
  const folderId = params.folderId as string; // Get folderId from URL

  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]); // Using FileRecord[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderId) return; // Don't fetch if folderId isn't available yet

    async function fetchFolderData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch folder details
        const folderRes = await fetch(`/api/folders/${folderId}`); // Needs GET /api/folders/[folderId]
        if (!folderRes.ok) {
          // Attempt to parse error, provide fallback
          let errorMsg = "Failed to fetch folder details";
          try {
            const errData = await folderRes.json();
            errorMsg = errData.error || errorMsg;
          } catch {}
          throw new Error(errorMsg);
        }
        const folderData: Folder = await folderRes.json();
        setFolder(folderData);

        // Fetch files for the folder
        const filesRes = await fetch(`/api/folders/${folderId}/files`);
        if (!filesRes.ok) {
          let errorMsg = "Failed to fetch files";
          try {
            const errData = await filesRes.json();
            errorMsg = errData.error || errorMsg;
          } catch {}
          throw new Error(errorMsg);
        }
        const filesData: FileRecord[] = await filesRes.json(); // Using FileRecord[]
        setFiles(filesData);
      } catch (err) {
        console.error(`Error fetching data for folder ${folderId}:`, err);
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchFolderData();
  }, [folderId]); // Re-run effect if folderId changes

  if (loading) {
    return <div className="p-4 text-center">Loading folder contents...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Error: {error}</p>
        <Link
          href="/library"
          className="text-blue-600 hover:underline mt-2 block"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Link
        href="/library"
        className="inline-flex items-center text-blue-600 hover:underline mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Library
      </Link>
      <h1 className="text-2xl font-bold mb-6">
        Folder: {folder?.name || folderId}
      </h1>

      {files.length === 0 ? (
        <p>This folder is empty.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center space-x-3 p-3 border rounded-md bg-white shadow-sm"
            >
              <DocumentIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
              <span className="flex-1 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                {getFileTypeDescription(file.type)}
              </span>
              {/* Add download button or link if needed */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
