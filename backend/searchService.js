// NEW: Using Google's Generative AI library
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ChromaClient } = require('chromadb');
const { getEmbeddingForQuery } = require('./ml_runner');

const API_KEY = "AIzaSyD8DQNx7Aagmp0_0U_CqsORNiXBmiK9yy8";

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

async function performRAG(queryText) {
  // 1. RETRIEVE: Perform semantic search (this part is the same)
  const queryEmbedding = await getEmbeddingForQuery(queryText);
  const collection = await chromaClient.getCollection({ name: "documents" });
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 5
  });

  const contextChunks = results.documents[0];

  // 2. AUGMENT: Create a prompt for the Gemini model
  const prompt = `You are a helpful AI assistant. Use the following context to answer the user's question. If the answer is not in the context, say "I cannot find the answer in the provided document."

  Context:
  ---
  ${contextChunks.join('\n---\n')}
  ---

  User's Question: ${queryText}

  Answer:`;

  // 3. GENERATE: Send the prompt to the Gemini LLM
  console.log('Sending augmented prompt to Gemini...');
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const answer = response.text();

  return {
    answer: answer,
    sources: contextChunks // Also return the sources for transparency
  };
}

module.exports = { performRAG };