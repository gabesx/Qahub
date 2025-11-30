import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_VERSION = 'v1';

export const api = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData (let browser set it with boundary)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Don't auto-redirect on password change endpoint - let the component handle it
      const isPasswordChange = error.config?.url?.includes('/change-password');
      
      if (!isPasswordChange) {
        localStorage.removeItem('token');
        localStorage.removeItem('rememberMe');
        // Store error message for login page
        const errorMessage = error.response?.data?.error?.message || 'Your session has expired. Please log in again.';
        localStorage.setItem('loginError', errorMessage);
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

