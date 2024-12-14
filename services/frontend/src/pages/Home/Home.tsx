import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-blue-600 text-center mb-6">Welcome to My App</h1>
      <p className="text-gray-700 text-lg text-center mb-6">
        Upload your HTML files, parse them, and extract structured JSON data effortlessly!
      </p>

      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-500">Upload HTML Files</h2>
          <p className="text-gray-600">
            You can upload multiple HTML files to our platform. Once uploaded, these files will be
            processed for parsing.
          </p>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-500">Parse and Extract JSON</h2>
          <p className="text-gray-600">
            Our parser extracts data from your uploaded HTML files and converts it into structured
            JSON format for easy analysis.
          </p>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-500">Organize and Visualize</h2>
          <p className="text-gray-600">
            Once parsed, you can explore, analyze, and download the extracted JSON data to suit your
            needs.
          </p>
        </div>
      </div>

      <div className="text-center mt-6">
        <Link
          to="/auth/login"
          className="inline-block px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
};

export default Home;
