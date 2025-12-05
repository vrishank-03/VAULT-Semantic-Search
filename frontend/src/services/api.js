import axios from 'axios';

// [ENV_CHECK] Ensure we target the correct backend port
const API_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- REQUEST INTERCEPTOR ---
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // [ATOMIC_LOG] Log every outgoing request for debugging
        console.log(`[API_REQUEST] ${config.method.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => Promise.reject(error)
);

// --- RESPONSE INTERCEPTOR (The Circuit Breaker) ---
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // [CIRCUIT_BREAKER] Handle 401 Unauthorized
        if (error.response && error.response.status === 401) {
            console.warn('[API_401] Unauthorized access detected.');

            // 1. Don't redirect if we are already on login/signup (prevents loops)
            const currentPath = window.location.pathname;
            if (currentPath !== '/login' && currentPath !== '/signup') {
                console.error('[API_401] Session expired. Clearing token and redirecting.');
                localStorage.removeItem('token');
                // Use window.location to ensure a clean state reset
                window.location.replace('/login');
            }
        }
        return Promise.reject(error);
    }
);

// --- Documents ---
export const uploadDocument = (files, roomId, socketId, signal) => {
    console.log(`[LOG] api.js: Sending ASYNC upload request for room ${roomId}`);
    const formData = new FormData();
    files.forEach((file) => formData.append('documents', file));
    formData.append('socketId', socketId);

    return api.post(`/documents/upload/${roomId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
    });
};

export const getDocument = async (documentId) => {
    console.log(`[LOG] api.js: Sending request to get document blob: ${documentId}...`);
    const response = await api.get(`/documents/download/${documentId}`, { responseType: 'blob' });
    return response.data;
};

export const getDocuments = (roomId) => {
    console.log(`[LOG] api.js: Sending request to get document list for room: ${roomId}...`);
    return api.get(`/documents/list/${roomId}`);
};

export const deleteDocument = (docId) => {
    console.log(`[LOG] api.js: Sending request to DELETE document: ${docId}...`);
    return api.delete(`/rooms/documents/${docId}`);
};

// --- Chat & Conversation ---
export const getConversations = (roomId) => {
    console.log(`[LOG] api.js: Getting conversations for room ${roomId}`);
    return api.get(`/chat/${roomId}`);
};

export const createNewConversation = (roomId) => {
    console.log(`[LOG] api.js: Creating new conversation in room ${roomId}`);
    return api.post(`/chat/${roomId}/new`);
};

export const getConversationHistory = (conversationId) => {
    console.log(`[LOG] api.js: Getting history for convo ${conversationId}`);
    return api.get(`/chat/history/${conversationId}`); 
};

export const deleteConversation = (conversationId) => {
    console.log(`[LOG] api.js: Deleting conversation ${conversationId}...`);
    return api.delete(`/chat/${conversationId}`);
};

export const searchChatHistory = (searchTerm) => {
    console.log(`[LOG] api.js: Searching history for term: ${searchTerm}`);
    return api.get(`/chat/search?q=${encodeURIComponent(searchTerm)}`);
};

export const postChatQuery = (query, conversationId, roomId, socketId, chatMode) => {
    const endpoint = `/chat/${roomId}/${conversationId}`;
    const payload = { query, socketId, chatMode };
    console.log(`[LOG] api.js: Posting streaming query to ${endpoint}`, payload);
    return api.post(endpoint, payload);
};

// --- Auth & User (CRITICAL FIXES HERE) ---

export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signupAdmin = (userData) => api.post('/auth/signup-admin', userData);

// [CRITICAL FIX] Removed IIFE wrapper. This is now a standard function.
// It will ONLY execute when called, not on import.
export const getUserInfo = async () => { 
    try { 
        console.log('[API_CALL] getUserInfo triggered.');
        const response = await api.get('/user'); 
        return response.data; 
    } catch (error) { 
        console.error('[API_ERROR] Error fetching user info:', error.message); 
        throw error; 
    } 
};

export const sendPasswordResetEmail = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => api.post('/auth/reset-password', { token, password });
export const checkVerificationStatus = (email) => api.get(`/auth/verification-status?email=${email}`);

// --- Products ---
export const requestProductCreation = (productData) => api.post('/products/request-product', productData);
export const getConfirmedProducts = () => api.get('/products/confirmed');
export const getPendingProducts = () => api.get('/products/pending');
export const approveProduct = (productId) => api.post(`/products/approve/${productId}`);
export const rejectProduct = (productId) => api.delete(`/products/reject/${productId}`);
export const getAllProducts = () => api.get('/products/all');
export const updateProduct = (productId, productData) => api.put(`/products/${productId}`, productData);
export const deleteProduct = (productId) => api.delete(`/products/${productId}`);

// --- Rooms ---
export const getRooms = () => api.get('/rooms');
export const createRoom = (roomData) => api.post('/rooms', roomData);
export const logRoomEntry = (roomId) => api.post(`/rooms/log-entry/${roomId}`).catch((err) => {
    console.error(`[API_ERROR] Failed to log room entry for room ${roomId}:`, err.message);
});
export const joinRoom = (roomId) => api.post(`/rooms/join/${roomId}`);
export const getRoomsForClient = (clientId) => api.get(`/rooms/client/${clientId}`);
export const sendDownstream = (roomId, assignIds) => api.post(`/rooms/send-downstream/${roomId}`, { assignIds });
export const editRoomPassword = (roomId, password) => api.put(`/rooms/password/${roomId}`, { password });

// --- JIT Access ---
export const getIncomingRequests = () => api.get('/jit/incoming');
export const approveRoomRequest = (requestId, duration) => api.put(`/jit/approve/${requestId}`, { duration });
export const rejectRoomRequest = (requestId) => api.put(`/jit/reject/${requestId}`);
export const revokeRequest = (requestId) => api.put(`/jit/revoke/${requestId}`);
export const requestAccess = (requestData) => api.post('/jit/request-access', requestData);
export const getOutgoingRequests = () => api.get('/jit/outgoing');
export const editRequest = (requestId, duration) => api.put(`/jit/edit/${requestId}`, { duration });

// --- Peer JIT ---
export const requestPeerAccess = (type, resourceId, duration) => api.post('/jit/peer-request', { type, resourceId, duration });
export const getIncomingPeerRequests = () => api.get('/jit/peer-incoming');
export const getOutgoingPeerRequests = () => api.get('/jit/peer-outgoing');
export const respondToPeerRequest = (requestId, type, action, duration) => api.put('/jit/peer-respond', { requestId, type, action, duration });

// --- User Management ---
export const getPendingUsers = () => api.get('/users/pending');
export const approveUser = (userId) => api.post(`/users/approve/${userId}`);
export const rejectUser = (userId) => api.delete(`/users/reject/${userId}`);
export const getTeam = () => api.get('/users/team');
export const getAllTeamMembers = () => api.get('/users/team/all');
export const getAllUsersForCto = () => api.get('/users/all-company');
export const getUsersForAdmin = () => api.get('/users/admin-users');
export const deactivateUser = (userId) => api.post(`/users/deactivate/${userId}`);
export const reactivateUser = (userId) => api.post(`/users/reactivate/${userId}`);
export const getAdminsForProduct = (productName) => api.get(`/users/admins-for-product?productName=${encodeURIComponent(productName)}`);

// --- Clients ---
export const getClients = () => api.get('/clients');
export const createClient = (clientData) => api.post('/clients', clientData);
export const getAdminClientAssignments = (adminId) => api.get(`/clients/assignments/${adminId}`);
export const updateAdminClientAssignments = (adminId, clientIds) => api.put(`/clients/assignments/${adminId}`, { clientIds });
export const getClientsForProduct = (productId) => api.get(`/clients/product/${productId}`);

export default api;