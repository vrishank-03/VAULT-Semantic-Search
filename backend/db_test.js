const { ChromaClient } = require('chromadb');
const sqlite3 = require('sqlite3').verbose();

const runDBTest = async () => {
  let sqliteStatus = 'Disconnected';
  let chromaStatus = 'Disconnected';

  // Test SQLite Connection
  try {
    const db = new sqlite3.Database(':memory:'); // Use in-memory DB for a quick test
    await new Promise((resolve, reject) => {
      db.get("SELECT 1", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    db.close();
    sqliteStatus = 'Connected';
  } catch (e) {
    sqliteStatus = `Error: ${e.message}`;
  }

  // Test ChromaDB Connection
  try {
    const client = new ChromaClient({ path: "http://localhost:8000" });
    await client.heartbeat(); // This function checks if the server is alive
    chromaStatus = 'Connected';
  } catch (e) {
    chromaStatus = `Error: ${e.message}`;
  }

  return { sqlite: sqliteStatus, chroma: chromaStatus };
};

module.exports = { runDBTest };