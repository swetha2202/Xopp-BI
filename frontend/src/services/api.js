import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  // Always read fresh from localStorage on every request
  const token = localStorage.getItem('pmdb_token');
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  } else {
    delete cfg.headers.Authorization;
  }
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pmdb_token');
      localStorage.removeItem('pmdb_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;