import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Use a custom event to notify the app to log out, which is safer than a hard redirect
      window.dispatchEvent(new Event('auth-error'));
    }
    return Promise.reject(error);
  }
);

export const resetPassword = (token, password) => api.post('/auth/reset-password', { token, password });
export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const googleLogin = (credential) => api.post('/auth/google', { credential });

// --- NEW API FUNCTIONS ---
export const checkVerificationStatus = (email) => api.get(`/auth/verification-status?email=${email}`);
export const sendPasswordResetEmail = (email) => api.post('/auth/forgot-password', { email });
// --- END NEW API FUNCTIONS ---

export const uploadDocument = (files) => {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('documents', file);
    });
    return api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const search = (query, history) => api.post('/search', { query, history });

export const getDocument = async (documentId) => {
    const response = await api.get(`/documents/${documentId}`, {
        responseType: 'blob',
    });
    return response.data;
};

export default api;