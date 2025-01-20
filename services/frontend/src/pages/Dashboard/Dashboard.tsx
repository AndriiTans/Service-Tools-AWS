import { Link } from 'react-router-dom';

const Dashboard = () => {
  return (
    <div className="bg-gray-50 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Link
          to="/dashboard/parser/upload"
          className="block bg-white shadow-md rounded-lg p-6 text-center border hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold text-blue-600">Upload</h2>
          <p className="text-gray-600 mt-2">Upload your files to start parsing.</p>
        </Link>

        <Link
          to="/dashboard/parser/results"
          className="block bg-white shadow-md rounded-lg p-6 text-center border hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold text-green-600">Results</h2>
          <p className="text-gray-600 mt-2">View parsed results from your uploads.</p>
        </Link>

        <Link
          to="/dashboard/parser/user-messages"
          className="block bg-white shadow-md rounded-lg p-6 text-center border hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold text-yellow-600">User messages selection</h2>
          <p className="text-gray-600 mt-2">
            View parsed results of your messages by file selection.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
