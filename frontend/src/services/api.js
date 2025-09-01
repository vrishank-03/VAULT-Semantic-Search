// import axios from 'axios';

// const API_URL = 'http://localhost:5000/api';

// export const uploadDocument = async (file) => {
//   const formData = new FormData();
//   formData.append('document', file); // 'document' must match the key in multer

//   try {
//     const response = await axios.post(`${API_URL}/documents/upload`, formData, {
//       headers: {
//         'Content-Type': 'multipart/form-data',
//       },
//     });
//     return response.data;
//   } catch (error) {
//     console.error("Error uploading document:", error);
//     throw error.response ? error.response.data : new Error("Network Error");
//   }
// };

// export const search = async (query, history) => {
//   try {
//     // Send both the query and the history in the request body
//     const response = await axios.post(`${API_URL}/search`, { query, history });
//     return response.data;
//   } catch (error) {
//     console.error("Error performing search:", error);
//     throw error.response ? error.response.data : new Error("Network Error");
//   }
// };

import axios from 'axios';
const API_URL = 'http://localhost:5000/api';

export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file);
  try {
    const response = await axios.post(`${API_URL}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    console.error("Error uploading document:", error);
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const search = async (query, history) => {
  try {
    // --- LOG 1: SERVICE LAYER ENTRY ---
    console.log("[api.js:search] STEP 1: Preparing to send search request.");
    console.log("[api.js:search]   - Query:", query);
    console.log("[api.js:search]   - History Payload:", history);
    
    const response = await axios.post(`${API_URL}/search`, { query, history });
    
    // --- LOG 4: NETWORK RESPONSE RECEIVED ---
    console.log("[api.js:search] STEP 4: Received response from backend:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error performing search:", error);
    throw error.response ? error.response.data : new Error("Network Error");
  }
};