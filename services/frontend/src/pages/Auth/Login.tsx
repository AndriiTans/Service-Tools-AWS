import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
    setErrorMessage(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.email || !formData.password) {
      setErrorMessage('Both fields are required!');
      return;
    }

    console.log('Logging in user:', formData);
    alert('Login successful!');
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg mt-10">
      <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">Login</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-gray-700 font-medium mb-2 text-left">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your email"
            className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-gray-700 font-medium mb-2 text-left">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter your password"
            className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

        <div className="pt-4">
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-300"
          >
            Login
          </button>
        </div>
      </form>

      <p className="text-center text-gray-600 mt-6">
        Don't have an account?{' '}
        <Link
          to="/register"
          className="text-blue-600 font-medium hover:underline hover:text-blue-800 transition duration-300"
        >
          Register here
        </Link>
      </p>
    </div>
  );
};

export default Login;
