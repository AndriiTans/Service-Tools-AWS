import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../../../../utils/httpClient';

interface ContentItem {
  content_type: string;
  parts: string[];
}

interface GroupedMessages {
  fileName: string;
  content: string[];
}

const UserMessagesList: React.FC = () => {
  const [filenames, setFilenames] = useState<string[]>([]);
  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);
  const [userMessages, setUserMessages] = useState<GroupedMessages[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [messagesCount, setMessagesCount] = useState<number>(0);

  useEffect(() => {
    const fetchFilenames = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<string[]>('/content-feed/get-all-filenames');
        setFilenames(response.data);
      } catch (error: unknown) {
        setError((error as Error).message || 'Failed to fetch filenames.');
      } finally {
        setLoading(false);
      }
    };
    fetchFilenames();
  }, []);

  const handleFileSelection = (filename: string): void => {
    setSelectedFilenames((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename],
    );
  };

  const fetchUserMessages = useCallback(async () => {
    if (selectedFilenames.length === 0) {
      setError('Please select at least one file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{ fileName: string; content: ContentItem[] }[]>(
        '/content-feed/get-user-messages-by-filename',
        {
          fileNames: selectedFilenames,
        },
      );

      const groupedMessages: GroupedMessages[] = response.data.map((item) => ({
        fileName: item.fileName,
        content: item.content.flatMap((contentItem) => contentItem.parts), // Flatten the 'parts' array
      }));

      setUserMessages(groupedMessages);

      const totalMessages = groupedMessages.reduce(
        (count, msgGroup) => count + msgGroup.content.length,
        0,
      );
      setMessagesCount(totalMessages);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch user messages.');
    } finally {
      setLoading(false);
    }
  }, [selectedFilenames]);

  const handleBack = (): void => {
    setUserMessages([]);
    setSelectedFilenames([]);
    setCopySuccess(null);
  };

  const handleCopy = (): void => {
    let globalIndex = 1;
    const textToCopy = userMessages
      .map((msgGroup) => {
        const messageText = msgGroup.content.map((msg) => `${globalIndex++}. ${msg}`).join('\n');
        return `${messageText}`;
      })
      .join('\n');
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopySuccess('Copied to clipboard!');
        setTimeout(() => setCopySuccess(null), 2000);
      })
      .catch(() => {
        setCopySuccess('Failed to copy.');
      });
  };

  if (loading) {
    return <p className="text-center text-gray-500">Loading...</p>;
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-md max-w-2xl mx-auto">
      {userMessages.length > 0 ? (
        <>
          <div className="flex flex-row space-x-2">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center"
            >
              Back to File Selection
            </button>

            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center"
            >
              Copy Messages
            </button>
            <div className="text-gray-700 ml-4 flex-1 text-center py-2 bg-blue-100 rounded-lg">
              {messagesCount} Messages
            </div>
          </div>

          {copySuccess && (
            <div className="my-2 p-2 bg-green-100 text-green-700 border border-green-300 rounded text-center">
              {copySuccess}
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <h4 className="text-lg font-semibold text-blue-800 mb-2">User Messages:</h4>
            {userMessages.map((msgGroup, index) => (
              <div key={index} className="mb-4">
                <h5 className="text-blue-700 font-semibold">{msgGroup.fileName}</h5>
                <ol className="list-decimal list-inside text-gray-700 space-y-1">
                  {msgGroup.content.map((message, idx) => (
                    <li
                      key={idx}
                      className="cursor-pointer select-text text-left leading-relaxed" // Left-aligned and increased line-height
                    >
                      {message}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Select & Filter Files</h3>

          <div className="mb-4 space-y-2 h-[60vh] overflow-auto border p-3 rounded bg-gray-50">
            {filenames.length > 0 ? (
              filenames.map((filename) => (
                <label key={filename} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilenames.includes(filename)}
                    onChange={() => handleFileSelection(filename)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{filename}</span>
                </label>
              ))
            ) : (
              <p className="text-gray-500 italic">No filenames available.</p>
            )}
          </div>

          <button
            onClick={fetchUserMessages}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get User Messages'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserMessagesList;
