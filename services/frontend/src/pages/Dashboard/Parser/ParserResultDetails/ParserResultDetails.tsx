import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../../../../utils/httpClient';

interface Content {
  content_type: string;
  parts: string[];
  _id: string;
}

interface ParserResult {
  _id: string;
  bucketName: string;
  fileName: string;
  authorRole: string;
  content: Content;
  order: number;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

const ParserResultDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Extract 'id' from the route params
  const [data, setData] = useState<ParserResult[] | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get<ParserResult[]>(
          `/content-feed/get-parsed-content?fileName=${id}`,
        );
        setData(response.data);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <p className="text-center text-gray-500">Loading...</p>;
  if (error) return <p className="text-center text-red-500">Error: {error}</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Parser Results for ID: {id}</h2>
      {data?.length && data.length > 0 ? (
        <div className="space-y-4">
          {data.map((item) => (
            <div
              key={item._id}
              className="border rounded-lg shadow-md p-4 bg-white hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-medium text-gray-700">
                Author Role: <span className="text-blue-600">{item.authorRole}</span>
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                <strong>Order:</strong> {item.order}
              </p>
              <p className="text-sm text-gray-500 mb-2">
                <strong>Created At:</strong> {new Date(item.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                <strong>Updated At:</strong> {new Date(item.updatedAt).toLocaleString()}
              </p>
              <h4 className="font-medium text-gray-600">Content:</h4>
              <ul className="list-none text-gray-700">
                {item.content.parts.map((part, index) => (
                  <li key={index}>{part}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center">No data found for the given ID.</p>
      )}
    </div>
  );
};

export default ParserResultDetails;
