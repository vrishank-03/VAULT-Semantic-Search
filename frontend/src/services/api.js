// frontend/src/services/api.js

import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API_REQUEST] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error('[API_ERROR_401] Authentication error (401). Logging out.');
      localStorage.removeItem('token');
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

// --- Password & Verification ---
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
  console.log(`[LOG] api.js: Sending upload request for room ${roomId}...`);
  const formData = new FormData();
  files.forEach((file) => formData.append('documents', file));
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

// --- [BUG_3_FIX] NEW FUNCTION ---
export const deleteDocument = (docId) => {
  console.log(`[LOG] api.js: Sending request to DELETE document: ${docId}...`);
  return api.delete(`/rooms/documents/${docId}`);
};

// --- Chat & Search ---
export const search = (query, history, conversationId, roomId, signal) => {
  console.log(`[LOG] api.js: Sending search request for convo ${conversationId}...`);
  return api.post(`/search/${roomId}`, { query, history, conversationId }, { signal });
};

export const createNewConversation = (roomId) => api.post(`/chat/new/${roomId}`);
export const getConversations = (roomId) => api.get(`/chat/conversations/${roomId}`);
export const getConversationHistory = (conversationId) => api.get(`/chat/history/${conversationId}`);

// --- Products ---
export const requestProductCreation = (productData) => api.post('/products/request-product', productData);
export const getConfirmedProducts = () => api.get('/products/confirmed');
export const getPendingProducts = () => api.get('/products/pending');
export const approveProduct = (productId) => api.post(`/products/approve/${productId}`);
export const rejectProduct = (productId) => api.delete(`/products/reject/${productId}`);
export const getAllProducts = () => api.get('/products/all');
export const updateProduct = (productId, productData) => api.put(`/products/${productId}`, productData);
// --- [NEW] ADD DELETE PRODUCT ---
export const deleteProduct = (productId) => {
  console.log(`[LOG] api.js: Sending request to DELETE product ${productId}...`);
  return api.delete(`/products/${productId}`);
};
// --- [END NEW] ---

// --- Rooms ---
export const getRooms = () => api.get('/rooms');
export const createRoom = (roomData) => api.post('/rooms', roomData);
export const logRoomEntry = (roomId) => {
  api.post(`/rooms/log-entry/${roomId}`).catch((err) => {
    console.error(`[API_ERROR] Failed to log room entry for room ${roomId}:`, err.message);
  });
};
export const joinRoom = (roomId) => api.post(`/rooms/join/${roomId}`);

// --- [BLOCK 6] NEW HIERARCHICAL DASHBOARD FUNCTION ---
export const getRoomsForClient = (clientId) => {
  console.log(`[LOG] api.js: [BLOCK 6] Sending request to get rooms for client ${clientId}...`);
  return api.get(`/rooms/client/${clientId}`);
};

// [ROOM_FIX] Modified "Send Downstream" function
export const sendDownstream = (roomId, assignIds) => {
  console.log(`[LOG] api.js: Sending request to send room ${roomId} downstream to IDs...`, assignIds);
  return api.post(`/rooms/send-downstream/${roomId}`, { assignIds });
};

// --- [ISSUE 6] NEW FUNCTION ---
export const editRoomPassword = (roomId, password) => api.put(`/rooms/password/${roomId}`, { password });

// --- [JIT_REFACTOR] Room-Level JIT Access ---
export const getIncomingRequests = () => api.get('/jit/incoming');
export const approveRoomRequest = (requestId, duration) => api.put(`/jit/approve/${requestId}`, { duration });
export const rejectRoomRequest = (requestId) => api.put(`/jit/reject/${requestId}`);
export const revokeRequest = (requestId) => api.put(`/jit/revoke/${requestId}`);
export const requestAccess = (requestData) => api.post('/jit/request-access', requestData);
export const getOutgoingRequests = () => api.get('/jit/outgoing');
export const editRequest = (requestId, duration) => api.put(`/jit/edit/${requestId}`, { duration });

// --- [BLOCK 6] Peer-to-Peer JIT ---
export const requestPeerAccess = (type, resourceId, duration) =>
  api.post('/jit/peer-request', { type, resourceId, duration });
export const getIncomingPeerRequests = () => api.get('/jit/peer-incoming');
export const getOutgoingPeerRequests = () => api.get('/jit/peer-outgoing');
export const respondToPeerRequest = (requestId, type, action, duration) =>
  api.put('/jit/peer-respond', { requestId, type, action, duration });

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
export const getAdminsForProduct = (productName) =>
  api.get(`/users/admins-for-product?productName=${encodeURIComponent(productName)}`);

// --- Clients ---
export const getClients = () => api.get('/clients');
export const createClient = (clientData) => api.post('/clients', clientData);
export const getAdminClientAssignments = (adminId) => api.get(`/clients/assignments/${adminId}`);
export const updateAdminClientAssignments = (adminId, clientIds) =>
  api.put(`/clients/assignments/${adminId}`, { clientIds });
export const getClientsForProduct = (productId) => api.get(`/clients/product/${productId}`);

export default api;