import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pyzero_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pyzero_token');
      localStorage.removeItem('pyzero_user');
      window.dispatchEvent(new Event('pyzero_auth_error'));
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
