import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// --- Document related API calls ---

export const uploadDocument = async (files) => { // Expects an array of File objects
  const formData = new FormData();
  files.forEach(file => {
    formData.append('documents', file); // Append each file with the key 'documents'
  });

  try {
    const response = await axios.post(`${API_URL}/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data; // This should contain success message and document IDs
  } catch (error) {
    console.error('API Error during document upload:', error.response?.data || error.message);
    throw error.response?.data || new Error('Unknown upload error');
  }
};

// --- Search related API calls ---

export const search = async (query, history) => {
  try {
            // --- LOG 1: SERVICE LAYER ENTRY ---
      console.log("[api.js:search] STEP 1: Preparing to send search request.");
      console.log("[api.js:search]   - Query:", query);
      console.log("[api.js:search]   - History Payload:", history);
      const response = await axios.post(`${API_URL}/search`, { query, history });
      console.log("[api.js:search] STEP 4: Received response from backend:", response.data);
      return response.data;
  } catch (error) {
    console.error('API Error during search:', error.response?.data || error.message);
    throw error.response?.data || new Error('Unknown search error');
  }
};