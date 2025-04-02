"use client";

import { useState, useEffect } from "react";
import { Folder } from "../../lib/types"; // Assuming Folder type is defined here
import Link from "next/link";
import { FolderIcon } from "@heroicons/react/24/outline";

export default function LibraryPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFolders() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/folders");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }
        const data: Folder[] = await response.json();
        setFolders(data);
      } catch (err) {
        console.error("Error fetching folders:", err);
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message || "Failed to load folders. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchFolders();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Loading folders...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Library - Folders</h1>
      {folders.length === 0 ? (
        <p>No folders found. Start by uploading some files!</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <li
              key={folder.id}
              className="border rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow"
            >
              <Link
                href={`/library/${folder.id}`}
                className="block p-4 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <FolderIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  <span className="font-medium truncate" title={folder.name}>
                    {folder.name}
                  </span>
                </div>
                {/* Optionally display folder creation date or other info */}
                {/* <p className="text-xs text-gray-500 mt-1">Created: {new Date(folder.created_at).toLocaleDateString()}</p> */}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
