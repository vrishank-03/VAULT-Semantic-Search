import axios from 'axios';

// ==================================================================
// 1. CREATE A PRE-CONFIGURED AXIOS INSTANCE
// ==================================================================
const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

// ==================================================================
// 2. REQUEST INTERCEPTOR: ADD THE AUTH TOKEN TO EVERY REQUEST
// ==================================================================
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// ==================================================================
// 3. RESPONSE INTERCEPTOR: HANDLE 401 ERRORS GLOBALLY
// ==================================================================
api.interceptors.response.use(
  (response) => response, // Directly return successful responses.
  (error) => {
    // Check if the error is a 401 Unauthorized
    if (error.response && error.response.status === 401) {
      // 1. Remove the invalid token
      localStorage.removeItem('token');
      // 2. Redirect to the login page
      window.location.href = '/login'; 
    }
    // For all other errors, just reject the promise.
    return Promise.reject(error);
  }
);


// ==================================================================
// 4. OUR API FUNCTIONS
// ==================================================================

export const loginUser = (credentials) => api.post('/auth/login', credentials);

export const signupUser = (userData) => api.post('/auth/signup', userData);

// --- Added the missing googleLogin function ---
// This function sends the Google credential to your backend's /auth/google endpoint.
export const googleLogin = (credential) => api.post('/auth/google', { credential });

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