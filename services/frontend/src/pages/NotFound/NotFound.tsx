const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-blue-600">404</h1>

      <p className="text-gray-600 text-lg mt-4">Oops! The page you're looking for doesn't exist.</p>

      <div className="mt-8">
        <a
          href="/"
          className="px-6 py-3 text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-600 transition duration-300"
        >
          Go Back Home
        </a>
      </div>

      <div className="mt-12">
        <img
          src="https://via.placeholder.com/400x300.png?text=Not+Found"
          alt="Not Found Illustration"
          className="max-w-full h-auto"
        />
      </div>
    </div>
  );
};

export default NotFound;
