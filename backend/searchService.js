// const { GoogleGenerativeAI } = require("@google/generative-ai");
// const { ChromaClient } = require('chromadb');
// const { getEmbeddingForQuery } = require('./ml_runner');

// const API_KEY = "AIzaSyD8DQNx7Aagmp0_0U_CqsORNiXBmiK9yy8";

// const chromaClient = new ChromaClient({ path: "http://localhost:8000" });
// const genAI = new GoogleGenerativeAI(API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

// // The function now accepts a 'history' array
// async function performRAG(queryText, history = []) {
//   // 1. RETRIEVE (This part is the same)
//   const queryEmbedding = await getEmbeddingForQuery(queryText);
//   const collection = await chromaClient.getCollection({ name: "documents" });
//   const results = await collection.query({
//     queryEmbeddings: [queryEmbedding],
//     nResults: 5
//   });

//   const contextChunks = results.documents[0];

//   // 2. AUGMENT: Create a new, more advanced prompt that includes the chat history

//   // First, format the history for the prompt
//   const formattedHistory = history
//     .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`)
//     .join('\n');

//   const prompt = `You are a Professional helpful AI assistant, who is there for academic research or corporate research purposes. Use the following context to answer the user's question. If the answer is not in the context, say "I cannot find the answer in the provided document."

//   Here is the recent conversation history:
//   ---
//   ${formattedHistory}
//   ---

//   Now, using the following retrieved document chunks, answer the user's latest question. The retrieved chunks may or may not be relevant. If the answer is not in the context, say "I cannot find the answer in the provided documents." If the user asks a question about the conversation itself (like "how many documents did I upload?"), answer it based on the history.

//   Retrieved Context Chunks:
//   ---
//   ${contextChunks.join('\n---\n')}
//   ---

//   User's Latest Question: ${queryText}

//   Answer:`;

//   // 3. GENERATE (This part is the same)
//   console.log('Sending augmented prompt with history to Gemini...');
//   const result = await model.generateContent(prompt);
//   const response = await result.response;
//   const answer = response.text();

//   return {
//     answer: answer,
//     sources: results.documents[0].map((doc, index) => ({ // Send back the full source object
//       text: doc,
//       metadata: results.metadatas[0][index]
//     }))
//   };
// }

// module.exports = { performRAG };

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ChromaClient } = require('chromadb');
const { getEmbeddingForQuery } = require('./ml_runner');
const { db } = require('./database');
require('dotenv').config();

const API_KEY = "AIzaSyD8DQNx7Aagmp0_0U_CqsORNiXBmiK9yy8";

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

async function performRAG(queryText, history = []) {
  const formattedHistory = history.map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n');
  const docList = await new Promise((resolve, reject) => {
    db.all('SELECT id, name FROM documents ORDER BY id DESC', [], (err, rows) => { // Get latest first
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

  // --- UPGRADE: LLM CALL #1 - THE QUERY ANALYZER ---
  const queryAnalyzerPrompt = `You are an expert query analyzer. Your task is to understand the user's intent based on their latest question and the conversation history. Transform their question into a concise and keyword-rich query suitable for a semantic vector search.

  RULES:
  - If the user refers to a specific document ID (e.g., "document 10"), the transformed query should be about the content of that document.
  - If the user refers to "the latest document", identify the latest document from the document list provided and transform the query to be about its content.
  - If the question is general, distill it into its core semantic meaning.
  
  Example:
  User Question: "in the latest document I sent, what does it say about the economy?"
  Latest Document: "ID: 11, Name: economic_report_q3.pdf"
  Transformed Query: "q3 economic report summary"
  
  Conversation History:
  ---
  ${formattedHistory}
  ---
  List of Uploaded Documents (Latest First):
  ---
  ${docList.map(d => `ID: ${d.id}, Name: ${d.name}`).join('\n')}
  ---
  User's Latest Question: "${queryText}"
  ---
  Transformed Search Query:`;

  console.log("\n--- SENDING TO QUERY ANALYZER ---");
  console.log(queryAnalyzerPrompt);
  console.log("---------------------------------\n");

  const analyzerResult = await model.generateContent(queryAnalyzerPrompt);
  const transformedQuery = await analyzerResult.response.text();
  console.log(`Transformed Query for Semantic Search: "${transformedQuery}"`);

  // 1. RETRIEVE (using the new, smarter query)
  const queryEmbedding = await getEmbeddingForQuery(transformedQuery);
  const collection = await chromaClient.getCollection({ name: "documents" });
  const initialResults = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 10
  });

  // --- RE-RANKING LOGIC ---
const rerankPrompt = `You are a helpful re-ranking assistant. From the following list of document chunks, identify ONLY the chunks that are the most relevant to the user's question. List the indices of the relevant chunks as a JSON array of numbers. For example: [0, 2, 4].

User's Question: "${queryText}"

Document Chunks:
---
${initialResults.documents[0].map((doc, i) => `[Chunk ${i}]:\n${doc}`).join('\n---\n')}
---

Relevant Chunk Indices (JSON array):`;

const rerankResult = await model.generateContent(rerankPrompt);
const rerankResponse = await rerankResult.response;
let relevantIndices = [];
try {
  const jsonString = rerankResponse.text().match(/\[(.*?)\]/)[0];
  relevantIndices = JSON.parse(jsonString);
} catch (e) {
  console.error("Could not parse re-ranker response, using top 3 results as fallback.", e);
  relevantIndices = [0, 1, 2]; 
}

const relevantSources = relevantIndices.map(index => ({
    text: initialResults.documents[0][index],
    metadata: initialResults.metadatas[0][index]
})).filter(Boolean);
// --- END OF RE-RANKING LOGIC ---

  // 2. AUGMENT (The prompt for the final answer is now simpler)
  const docCount = docList.length;
  const systemStatus = `The user has currently uploaded a total of ${docCount} document(s).`;
  const labeledContext = relevantSources.length > 0
    ? relevantSources.map(source => `[Source from Document ID ${source.metadata.documentId}]:\n${source.text}`).join('\n---\n')
    : "No relevant document chunks were found for this query.";

  // --- LLM CALL #2 - THE ANSWER SYNTHESIZER ---
  const finalPrompt = `You are a helpful AI assistant named VAULT. Use the provided context to answer the user's question.

  - Answer based ONLY on the Labeled Retrieved Context.
  - If the context is empty or doesn't contain the answer, say so.
  - Be conversational and synthesize information from multiple sources if necessary.
  
  Context:
  ${labeledContext}
  ---
  User's Original Question: ${queryText}
  ---
  Answer:`;
  
  console.log("\n--- FINAL PROMPT SENT TO GEMINI ---");
  console.log(finalPrompt);
  console.log("---------------------------------\n");

  const finalResult = await model.generateContent(finalPrompt);
  const finalResponse = await finalResult.response;
  const answer = finalResponse.text();
  
  return {
    answer: answer,
    sources: relevantSources
  };
}

module.exports = { performRAG };