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

// --- [MODIFIED] Document Upload (now room-aware) ---
export const uploadDocument = (files, roomId, signal) => {
    console.log(`[LOG] api.js: Sending upload request for room ${roomId} with cancellation signal...`);
    const formData = new FormData();
    files.forEach(file => {
        formData.append('documents', file);
    });
    // [MODIFIED] Route is now room-specific
    return api.post(`/documents/upload/${roomId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: signal, 
    });
};
// --- [END MODIFIED] ---

// --- [MODIFIED] Search (now room-aware) ---
export const search = (query, history, conversationId, roomId, signal) => {
    console.log(`[LOG] api.js: Sending search request for Convo ID: ${conversationId} in room ${roomId}...`);
    // [MODIFIED] Route is now room-specific
    return api.post(`/search/${roomId}`, { query, history, conversationId }, { signal });
};
// --- [END MODIFIED] ---

// --- [MODIFIED] Get Single Document (for PDF Viewer) ---
export const getDocument = async (documentId) => {
    console.log(`[LOG] api.js: Sending request to get document blob: ${documentId}...`);
    const response = await api.get(`/documents/download/${documentId}`, {
        responseType: 'blob',
    });
    return response.data;
};
// --- [END MODIFIED] ---

// --- [MODIFIED] Get Document List (now room-aware) ---
export const getDocuments = (roomId) => {
    console.log(`[LOG] api.js: Sending request to get document list for room: ${roomId}...`);
    return api.get(`/documents/list/${roomId}`);
};
// --- [END MODIFIED] ---

// --- [MODIFIED] Now requires a roomId ---
export const createNewConversation = (roomId) => {
    console.log(`[LOG] api.js: Sending request to create new conversation in room: ${roomId}...`);
    return api.post(`/chat/new/${roomId}`);
};

// --- [MODIFIED] Now requires a roomId ---
export const getConversations = (roomId) => {
    console.log(`[LOG] api.js: Sending request to get conversations for room: ${roomId}...`);
    return api.get(`/chat/conversations/${roomId}`);
};
// --- [END MODIFIED] ---

// --- NEW FUNCTION START ---
export const getConversationHistory = (conversationId) => {
    console.log(`[LOG] api.js: Sending request to get history for conversation ID: ${conversationId}...`);
    return api.get(`/chat/history/${conversationId}`);
};
// --- NEW FUNCTION END ---

// --- [NEW] PRODUCT API FUNCTION ---
export const requestProductCreation = (productData) => {
    console.log('[LOG] api.js: Sending request to create new product with data:', productData);
    return api.post('/products/request-product', productData);
};
// --- [END NEW] ---

// --- [NEW] GET CONFIRMED PRODUCTS FUNCTION ---
export const getConfirmedProducts = () => {
    console.log('[LOG] api.js: Sending request to get confirmed products...');
    return api.get('/products/confirmed');
};
// --- [END NEW] ---

// --- [NEW] CHAT ROOM API FUNCTIONS ---
export const getRooms = () => {
    console.log('[LOG] api.js: Sending request to get chat rooms...');
    return api.get('/rooms');
};

export const createRoom = (roomData) => {
    console.log('[LOG] api.js: Sending request to create new chat room...', roomData);
    return api.post('/rooms', roomData);
};
// --- [END NEW] ---

// --- [NEW] CLIENT API FUNCTIONS ---
export const getClients = () => {
    console.log('[LOG] api.js: Sending request to get clients for admin...');
    return api.get('/clients');
};

export const createClient = (clientData) => {
    console.log('[LOG] api.js: Sending request to create new client...', clientData);
    return api.post('/clients', clientData);
};
// --- [END NEW] ---

// --- [NEW] AUDIT LOG FUNCTION ---
export const logRoomEntry = (roomId) => {
    console.log(`[LOG] api.js: Logging entry into room ${roomId}...`);
    api.post(`/rooms/log-entry/${roomId}`).catch(err => {
        console.error(`[API_ERROR] Failed to log room entry for room ${roomId}:`, err.message);
    });
};
// --- [END NEW] ---

// --- [NEW] USER APPROVAL API FUNCTIONS ---
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
// --- [END NEW] ---


export default api;