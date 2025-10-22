import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
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
      console.error("Authentication error (401). Logging out.");
      localStorage.removeItem('token');
      window.location.pathname = '/login'; 
    }
    return Promise.reject(error);
  }
);

export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const signupUser = (userData) => api.post('/auth/signup', userData);

// --- MODIFICATION BELOW ---

export const googleLogin = (credential, pictureUrl) => { // <-- 1. MODIFIED SIGNATURE
    console.log("[LOG] api.js: Sending Google login request with pictureUrl:", pictureUrl); // <-- 2. ADDED LOG
    return api.post('/auth/google', { credential, pictureUrl }); // <-- 3. MODIFIED BODY
};

// --- END OF MODIFICATION ---

export const sendPasswordResetEmail = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => api.post('/auth/reset-password', { token, password });

export const getUserInfo = async () => {
    try {
        const response = await api.get('/user');
        return response.data;
    } catch (error) {
        console.error('Error fetching user info:', error);
        throw error;
    }
};

export const checkVerificationStatus = (email) => api.get(`/auth/verification-status?email=${email}`);

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

export const getDocuments = () => api.get('/documents');

export default api;