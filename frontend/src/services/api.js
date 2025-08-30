import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file); // 'document' must match the key in multer

  try {
    const response = await axios.post(`${API_URL}/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error uploading document:", error);
    throw error.response ? error.response.data : new Error("Network Error");
  }
};