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
    console.log(`[API_REQUEST] ${config.method.toUpperCase()} ${config.url}`);
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("[API_ERROR_401] Authentication error (401). Logging out.");
      localStorage.removeItem('token');
      // Use replace to avoid back-button to protected routes
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const signupUser = (userData) => api.post('/auth/signup', userData);

// --- [SIGNUP_FIX] NEW FUNCTION ---
export const signupAdmin = (userData) => {
    console.log('[LOG] api.js: Sending request to sign up ADMIN...', userData);
    return api.post('/auth/signup-admin', userData);
};
// --- [END SIGNUP_FIX] ---

// --- [TASK 16] REMOVED googleLogin function ---

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

// --- Documents ---
export const uploadDocument = (files, roomId, signal) => {
    console.log(`[LOG] api.js: Sending upload request for room ${roomId} with cancellation signal...`);
    const formData = new FormData();
    files.forEach(file => {
        formData.append('documents', file);
    });
    return api.post(`/documents/upload/${roomId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: signal, 
    });
};
export const getDocument = async (documentId) => {
    console.log(`[LOG] api.js: Sending request to get document blob: ${documentId}...`);
    const response = await api.get(`/documents/download/${documentId}`, {
        responseType: 'blob',
    });
    return response.data;
};
export const getDocuments = (roomId) => {
    console.log(`[LOG] api.js: Sending request to get document list for room: ${roomId}...`);
    return api.get(`/documents/list/${roomId}`);
};

// --- Chat & Search ---
export const search = (query, history, conversationId, roomId, signal) => {
    console.log(`[LOG] api.js: Sending search request for Convo ID: ${conversationId} in room ${roomId}...`);
    return api.post(`/search/${roomId}`, { query, history, conversationId }, { signal });
};
export const createNewConversation = (roomId) => {
    console.log(`[LOG] api.js: Sending request to create new conversation in room: ${roomId}...`);
    return api.post(`/chat/new/${roomId}`);
};
export const getConversations = (roomId) => {
    console.log(`[LOG] api.js: Sending request to get conversations for room: ${roomId}...`);
    return api.get(`/chat/conversations/${roomId}`);
};
export const getConversationHistory = (conversationId) => {
    console.log(`[LOG] api.js: Sending request to get history for conversation ID: ${conversationId}...`);
    return api.get(`/chat/history/${conversationId}`);
};

// --- Products ---
export const requestProductCreation = (productData) => {
    console.log('[LOG] api.js: Sending request to create new product with data:', productData);
    return api.post('/products/request-product', productData);
};
export const getConfirmedProducts = () => {
    console.log('[LOG] api.js: Sending request to get confirmed products...');
    return api.get('/products/confirmed');
};

// --- [PHASE 1.C] NEW FUNCTIONS ---
export const getPendingProducts = () => {
    console.log('[LOG] api.js: [PHASE 1.C] Sending request to get PENDING products...');
    return api.get('/products/pending');
};

export const approveProduct = (productId) => {
    console.log(`[LOG] api.js: [PHASE 1.C] Sending request to APPROVE product ${productId}...`);
    return api.post(`/products/approve/${productId}`);
};

export const rejectProduct = (productId) => {
    console.log(`[LOG] api.js: [PHASE 1.C] Sending request to REJECT product ${productId}...`);
    return api.delete(`/products/reject/${productId}`);
};
// --- [END NEW FUNCTIONS] ---

// --- [PHASE 1.D] NEW FUNCTIONS ---
export const getAllProducts = () => {
    console.log('[LOG] api.js: [PHASE 1.D] Sending request to get ALL products...');
    return api.get('/products/all');
};

export const updateProduct = (productId, productData) => {
    console.log(`[LOG] api.js: [PHASE 1.D] Sending request to UPDATE product ${productId}...`);
    return api.put(`/products/${productId}`, productData);
};
// --- [END NEW FUNCTIONS] ---


// --- Rooms ---
export const getRooms = () => {
    console.log('[LOG] api.js: Sending request to get chat rooms...');
    return api.get('/rooms');
};
export const createRoom = (roomData) => {
    console.log('[LOG] api.js: Sending request to create new chat room...', roomData);
    return api.post('/rooms', roomData);
};
export const logRoomEntry = (roomId) => {
    console.log(`[LOG] api.js: Logging entry into room ${roomId}...`);
    api.post(`/rooms/log-entry/${roomId}`).catch(err => {
        console.error(`[API_ERROR] Failed to log room entry for room ${roomId}:`, err.message);
    });
};
export const joinRoom = (roomId) => {
    console.log(`[LOG] api.js: Sending request to join room ${roomId}...`);
    return api.post(`/rooms/join/${roomId}`);
};

// --- JIT Access Request Management Functions ---
export const getPendingRoomRequests = () => {
    console.log('[LOG] api.js: Sending request to get pending room requests...');
    return api.get('/rooms/requests/pending');
};
export const approveRoomRequest = (requestId, duration) => {
    console.log(`[LOG] api.js: Sending request to approve room request ${requestId} for duration ${duration}...`);
    return api.put(`/rooms/requests/approve/${requestId}`, { duration });
};
export const rejectRoomRequest = (requestId) => {
    console.log(`[LOG] api.js: Sending request to reject room request ${requestId}...`);
    return api.put(`/rooms/requests/reject/${requestId}`);
};

// --- User Management ---
export const getPendingUsers = () => {
    console.log('[LOG] api.js: Sending request to get pending users...');
    return api.get('/users/pending');
};
export const approveUser = (userId) => {
    console.log(`[LOG] api.js: Sending request to approve user ${userId}...`);
    return api.post(`/users/approve/${userId}`);
};
export const rejectUser = (userId) => {
    console.log(`[LOG] api.js: Sending request to REJECT user ${userId}...`);
    return api.delete(`/users/reject/${userId}`);
};
export const getTeam = () => {
    console.log('[LOG] api.js: Sending request to get active team...');
    return api.get('/users/team');
};
export const getAllTeamMembers = () => {
    console.log('[LOG] api.js: Sending request to get ALL team members...');
    return api.get('/users/team/all');
};
export const deactivateUser = (userId) => {
    console.log(`[LOG] api.js: Sending request to DEACTIVATE user ${userId}...`);
    return api.post(`/users/deactivate/${userId}`);
};
export const reactivateUser = (userId) => {
    console.log(`[LOG] api.js: Sending request to REACTIVATE user ${userId}...`);
    return api.post(`/users/reactivate/${userId}`);
};

// --- [SIGNUP_FIX] NEW FUNCTION ---
export const getAdminsForProduct = (productName) => {
    console.log(`[LOG] api.js: Sending request to get admins for product: ${productName}...`);
    return api.get(`/users/admins-for-product?productName=${encodeURIComponent(productName)}`);
};
// --- [END SIGNUP_FIX] ---

// --- Clients ---
export const getClients = () => {
    console.log('[LOG] api.js: Sending request to get clients for admin...');
    return api.get('/clients');
};
export const createClient = (clientData) => {
    console.log('[LOG] api.js: Sending request to create new client...', clientData);
    return api.post('/clients', clientData);
};

export default api;