const express = require('express');
const cors = require('cors');
const { runMLTest } = require('./ml_runner.js');
const { runDBTest } = require('./db_test.js');

const app = express();
const PORT = 5000;

app.use(cors());

app.get('/api/test-pipeline', async (req, res) => {
  console.log("Received request for pipeline test...");
  try {
    const dbResult = await runDBTest();
    console.log("DB Test Complete:", dbResult);

    // The first run of this will be slow as the model downloads
    console.log("Starting ML Model test... This might take a moment.");
    const mlResult = await runMLTest();
    console.log("ML Test Complete:", mlResult);

    res.json({
      frontend: "OK",
      backend: "OK",
      ml_model: mlResult.model || mlResult.status,
      sqlite: dbResult.sqlite,
      chromadb: dbResult.chroma,
    });
  } catch (error) {
    console.error("Error during pipeline test:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});