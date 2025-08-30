import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const testSystemPipeline = async () => {
  try {
    const response = await axios.get(`${API_URL}/test-pipeline`);
    return response.data;
  } catch (error) {
    console.error("Error testing pipeline:", error);
    return error.response ? error.response.data : { error: "Network Error" };
  }
};