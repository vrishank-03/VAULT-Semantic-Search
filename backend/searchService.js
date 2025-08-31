const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ChromaClient } = require('chromadb');
const { getEmbeddingForQuery } = require('./ml_runner');

const API_KEY = "AIzaSyD8DQNx7Aagmp0_0U_CqsORNiXBmiK9yy8";

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

async function performRAG(queryText) {
  // 1. RETRIEVE
  const queryEmbedding = await getEmbeddingForQuery(queryText);
  const collection = await chromaClient.getCollection({ name: "documents" });
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 5
  });

  // THIS IS THE KEY CHANGE
  // Instead of just sending the text, we'll send an object with the text and its metadata.
  const sources = results.documents[0].map((doc, index) => ({
    text: doc,
    metadata: results.metadatas[0][index]
  }));

  const contextText = sources.map(s => s.text).join('\n---\n');

  // 2. AUGMENT
  const prompt = `You are a Professional helpful AI assistant, who is there for academic research or corporate research purposes. Use the following context to answer the user's question. If the answer is not in the context, say "I cannot find the answer in the provided document."

  Context:
  ---
  ${contextText}
  ---

  User's Question: ${queryText}

  Answer:`;

  // 3. GENERATE
  console.log('Sending augmented prompt to Gemini...');
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const answer = response.text();

  return {
    answer: answer,
    sources: sources // This is an array of objects
  };
}

module.exports = { performRAG };