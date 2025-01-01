import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../../utils/httpClient';

const ParserResults = () => {
  const [filenames, setFilenames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);

  const fetchFilenames = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await apiClient.get('/content-feed/get-all-filenames');
      setFilenames(response.data);
    } catch (error: unknown) {
      setError((error as Error).message || 'Failed to fetch filenames.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilenames();
  }, []);

  const handleDeleteClick = (filename: string) => {
    setSelectedFilename(filename);
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedFilename) {
      setError('No file selected');
      return;
    }

    try {
      await apiClient.delete(
        `/content-feed/delete-messages-by-filename?fileName=${encodeURIComponent(
          selectedFilename,
        )}`,
      );
      setShowModal(false);
      setSelectedFilename(null);
      setSuccessMessage(`Successfully deleted ${selectedFilename}`);
      fetchFilenames();
    } catch (error: unknown) {
      setError((error as Error).message || 'Failed to delete file.');
    }
  };

  const handleCancelDelete = () => {
    setShowModal(false);
    setSelectedFilename(null);
  };

  if (loading) {
    return <p className="text-center text-gray-500">Loading...</p>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">Parser Results</h2>

      {successMessage && (
        <div className="mb-4 p-4 text-green-800 bg-green-100 border border-green-200 rounded">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 text-red-800 bg-red-100 border border-red-200 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filenames?.map((filename, index) => (
          <div
            key={index}
            className="relative from-blue-50 to-blue-100 border border-gray-200 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 group"
          >
            <Link
              to={`file/${encodeURIComponent(filename)}`}
              className="block p-6 text-center"
              title={filename} // Tooltip for full filename on hover
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                  {filename.charAt(0).toUpperCase()}
                </div>
                <p className="text-gray-700 font-medium break-words hover:text-blue-600 transition-all">
                  {filename}
                </p>
              </div>
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent link click when clicking delete
                handleDeleteClick(filename);
              }}
              className="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700 rounded-full flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Delete"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-red-500">{selectedFilename}</span>?
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleCancelDelete}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParserResults;
