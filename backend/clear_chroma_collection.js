const { ChromaClient } = require('chromadb');

const client = new ChromaClient({ path: "http://localhost:8000" });
const collectionName = "documents";

async function clearCollection() {
  console.log(`Attempting to delete collection: '${collectionName}'...`);
  
  try {
    await client.deleteCollection({ name: collectionName });
    console.log(`Collection '${collectionName}' deleted successfully.`);
  } catch (error) {
    // It's possible the collection doesn't exist, which is also a success state. (false failure)
    if (error.message.includes("does not exist")) {
      console.log(`Collection '${collectionName}' does not exist, nothing to delete.`);
    } else {
      console.error("Failed to delete collection:", error);
    }
  }
}

clearCollection();