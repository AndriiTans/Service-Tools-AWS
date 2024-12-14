import React, { useState } from 'react';
import axios from 'axios';
import apiClient from '../../../../utils/httpClient';
import { LoadingModal } from '../../../../components';

const Upload = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFiles || selectedFiles.length === 0) {
      setErrorMessage('No files selected! Please choose at least one HTML file.');
      return;
    }

    setLoading(true);
    try {
      const fileDataArray = Array.from(selectedFiles).map((file) => ({
        fileName: file.name,
        contentType: file.type,
      }));

      const { data: responseData } = await apiClient.post('/upload/generate-upload-urls', {
        fileDataArray,
      });

      for (const [index, file] of Array.from(selectedFiles).entries()) {
        const { url, key } = responseData.uploadUrls[index];

        await axios.put(url, file, {
          headers: {
            'Content-Type': file.type,
          },
        });
        console.log(`Uploaded ${file.name} as ${key}`);
      }

      setSuccessMessage(`${selectedFiles.length} file(s) uploaded successfully!`);
      setSelectedFiles(null);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(`Error uploading files: ${error.message}`);
        console.error(error);
      } else {
        setErrorMessage('An unexpected error occurred.');
        console.error('Unexpected error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-blue-600 mb-4">Upload HTML Files</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="htmlUpload" className="block text-gray-700 font-medium mb-2">
            Select HTML Files
          </label>
          <input
            type="file"
            id="htmlUpload"
            accept=".html"
            multiple
            onChange={handleFileChange}
            className="block w-full text-gray-700 border border-gray-300 rounded-lg p-2"
          />
          {errorMessage && <p className="text-red-600 mt-2">{errorMessage}</p>}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
        >
          Upload
        </button>
      </form>

      {successMessage && <p className="text-green-600 mt-4">{successMessage}</p>}

      {selectedFiles && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-700">Selected Files:</h3>
          <ul className="list-disc list-inside mt-2 text-gray-600">
            {Array.from(selectedFiles).map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && <LoadingModal text="Uploading files, please wait..." />}
    </div>
  );
};

export default Upload;
