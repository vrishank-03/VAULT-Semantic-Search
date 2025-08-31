const { ChromaClient } = require('chromadb');

const client = new ChromaClient({ path: "http://localhost:8000" });

async function queryData() {
  console.log("Attempting to connect to ChromaDB and get collection...");

  try {
    const collection = await client.getCollection({ name: "documents" });

    console.log("Collection retrieved. Fetching 5 items...");

    // The .get() method retrieves items from the collection
    const items = await collection.get({
      limit: 5 // Get the first 5 items
    });

    console.log("Successfully retrieved items:");
    console.log(JSON.stringify(items, null, 2)); // Pretty-print the JSON

  } catch (error) {
    console.error("Failed to query ChromaDB:", error);
  }
}

queryData();