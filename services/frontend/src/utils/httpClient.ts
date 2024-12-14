import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BASE_API_URL;

let tokenCache: string | null = null;

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (!tokenCache) {
      tokenCache = localStorage.getItem('authToken');
    }

    if (tokenCache) {
      config.headers.Authorization = `Bearer ${tokenCache}`;
    }
    console.log('Request sent:', config);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('Response received:', response);
    return response;
  },
  (error) => {
    console.error('Error in response:', error);

    if (error.response && error.response.status === 401) {
      console.log('Unauthorized!');
      tokenCache = null;
    }

    return Promise.reject(error);
  },
);

export default apiClient;
