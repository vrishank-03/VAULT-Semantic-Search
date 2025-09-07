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
// 3. NEW: RESPONSE INTERCEPTOR: HANDLE 401 ERRORS GLOBALLY
// ==================================================================
// This function runs AFTER a response is received.
api.interceptors.response.use(
  (response) => response, // Directly return successful responses.
  (error) => {
    // Check if the error is a 401 Unauthorized
    if (error.response && error.response.status === 401) {
      // 1. Remove the invalid token
      localStorage.removeItem('token');
      // 2. Redirect to the login page
      // Use window.location to force a page reload, clearing all app state.
      window.location.href = '/login'; 
      // You could also use a routing library's navigation function here.
    }
    // For all other errors, just reject the promise.
    return Promise.reject(error);
  }
);


// ==================================================================
// 4. YOUR API FUNCTIONS (Unchanged)
// ==================================================================

export const loginUser = (credentials) => api.post('/auth/login', credentials);

export const signupUser = (userData) => api.post('/auth/signup', userData);

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