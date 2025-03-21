import { useState, FormEvent, ChangeEvent } from "react";
import { UploadResult } from "../../lib/types";

interface FileUploaderProps {
  onUploadComplete?: (folderId: string, files: File[]) => void;
}

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);
    }
  };

  const handleFolderNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFolderName(e.target.value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!folderName.trim()) {
      setErrorMessage("Please enter a folder name");
      return;
    }

    if (files.length === 0) {
      setErrorMessage("Please select at least one file");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setUploadProgress(20); // Start with some progress to indicate the upload has begun

    try {
      // Create a FormData object to send the files and folder name
      const formData = new FormData();
      formData.append("folderName", folderName);

      // Append each file to the FormData
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Set indeterminate progress
      setUploadProgress(50);

      // Use the combined upload API route
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Check if this is a row-level security policy error
        if (
          responseData.error &&
          responseData.error.includes("security policy")
        ) {
          throw new Error(
            "Permission denied: Unable to upload files due to security policies. Please contact your administrator."
          );
        } else {
          throw new Error(responseData.error || "Upload failed");
        }
      }

      const result: UploadResult = responseData;

      // Call the onUploadComplete callback if provided
      if (onUploadComplete && result.success) {
        onUploadComplete(result.folderId, files);
      }

      // Reset the form
      setFiles([]);
      setFolderName("");
      setUploadProgress(100);

      // Reset progress after a short delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 2000);
    } catch (error) {
      console.error("Error uploading files:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An error occurred while uploading files. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="folderName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Folder Name
          </label>
          <input
            type="text"
            id="folderName"
            value={folderName}
            onChange={handleFolderNameChange}
            className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="Enter folder name"
            disabled={isUploading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Files
          </label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={isUploading}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">
              Selected Files ({files.length})
            </h2>
            <ul className="border rounded-md divide-y max-w-full">
              {files.map((file, index) => (
                <li key={index} className="p-3 flex justify-between">
                  <div className="flex items-center">
                    <span className="font-medium truncate max-w-xs">
                      {file.name}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({(file.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{file.type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-red-700">{errorMessage}</p>
          </div>
        )}

        {isUploading && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Uploading... Please wait while files are being processed
            </p>
          </div>
        )}

        {uploadProgress === 100 && !isUploading && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <p className="text-green-700">Files uploaded successfully!</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isUploading
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          }`}
        >
          {isUploading ? "Uploading..." : "Create Folder & Upload Files"}
        </button>
      </form>
    </div>
  );
}
