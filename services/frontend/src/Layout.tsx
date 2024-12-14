import { Outlet, Link } from 'react-router-dom';
import './index.css';

const Layout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-500 to-blue-700 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Service App</h1>
          <nav>
            <ul className="flex space-x-6">
              <li>
                <Link
                  to="/dashboard"
                  className="text-white hover:text-blue-200 transition duration-300"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/parser/upload"
                  className="text-white hover:text-blue-200 transition duration-300"
                >
                  Upload
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/parser/results"
                  className="text-white hover:text-blue-200 transition duration-300"
                >
                  Parser results
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto p-6">
          <Outlet />
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm">
            © 2024 My App. All rights reserved. |{' '}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
