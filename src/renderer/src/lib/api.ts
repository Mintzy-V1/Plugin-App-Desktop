import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mintzy_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    const refreshedToken = res.headers['x-refreshed-jwt'];
    if (refreshedToken) {
      localStorage.setItem('mintzy_token', refreshedToken);
    }
    return res;
  },
  async (error) => {
    const req = error.config;
    if (error.response?.status !== 401 || req._retry) return Promise.reject(error);
    req._retry = true;
    try {
      const refreshToken = localStorage.getItem('mintzy_token');
      if (!refreshToken) throw new Error('No token');
      const res = await axios.post(`${API_BASE}/api/v1/users/refresh`, {}, {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });
      const newToken = res.data?.jwt;
      if (newToken) {
        localStorage.setItem('mintzy_token', newToken);
        req.headers.Authorization = `Bearer ${newToken}`;
        return api(req);
      }
    } catch {}
    localStorage.removeItem('mintzy_token');
    window.dispatchEvent(new CustomEvent('auth:expired'));
    return Promise.reject(error);
  }
);

export default api;
