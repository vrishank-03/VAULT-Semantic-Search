const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getEmbeddingForQuery } = require('./ml_runner');
const { getDb, chromaClient } = require('./database');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

async function generateWithRetry(prompt, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error) {
            if (error.status === 503 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Gemini API overloaded. Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("Gemini API Error:", error);
                throw error;
            }
        }
    }
}

async function performRAG(userId, queryText, history = []) {
    console.log(`\n[LOG] --- 1. ENTERING performRAG for User ${userId} ---`);
    const db = getDb();

    const formattedHistory = history.map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n');
    
    const docList = await new Promise((resolve, reject) => {
        db.all('SELECT id, name FROM documents WHERE user_id = ? ORDER BY id DESC', [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    const queryAnalyzerPrompt = `You are an expert query analyzer. Your task is to understand the user's intent based on their latest question and the conversation history. Transform their question into a concise and keyword-rich query suitable for a semantic vector search.

    RULES:
    - If the user refers to a specific document ID (e.g., "document 10"), the transformed query should be about the content of that document.
    - If the user refers to "the latest document", identify the latest document from the document list provided and transform the query to be about its content.
    - If the question is general, distill it into its core semantic meaning.
    
    Conversation History:
    ---
    ${formattedHistory}
    ---
    List of Uploaded Documents (Latest First):
    ---
    ${docList.map(d => `ID: ${d.id}, Name: ${d.name}`).join('\n') || 'No documents uploaded yet.'}
    ---
    User's Latest Question: "${queryText}"
    ---
    Transformed Search Query:`;

    console.log("[LOG] --- 2. CALLING QUERY ANALYZER ---");
    const analyzerResult = await generateWithRetry(queryAnalyzerPrompt);
    const analyzerResponse = analyzerResult.response;
    const transformedQuery = analyzerResponse.text();
    console.log(`[LOG] --- 3. Query Analyzer Output: "${transformedQuery}" ---`);

    console.log("[LOG] --- 4. Retrieving embedding and querying ChromaDB ---");
    const queryEmbedding = await getEmbeddingForQuery(transformedQuery);
    const collection = await chromaClient.getCollection({ name: "documents" });

    const initialResults = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 10,
        where: { "userId": userId }
    });
    console.log(`[LOG] --- 5. ChromaDB Retrieved ${initialResults?.documents?.[0]?.length || 0} chunks ---`);

    if (!initialResults || initialResults.documents.length === 0 || initialResults.documents[0].length === 0) {
        console.log("[LOG] No relevant document chunks found. Returning early.");
        return {
            answer: "I couldn't find any relevant information in your documents to answer that question. Please try rephrasing or upload a relevant document.",
            sources: []
        };
    }

    const rerankPrompt = `You are a helpful and professional re-ranking assistant. From the following list of document chunks, identify ONLY the chunks that are the most relevant to the user's question. List the indices of the relevant chunks as a JSON array of numbers. For example: [0, 2, 4].

    User's Question: "${queryText}"

    Document Chunks:
    ---
    ${initialResults.documents[0].map((doc, i) => `[Chunk ${i}]:\n${doc}`).join('\n---\n')}
    ---

    Relevant Chunk Indices (JSON array):`;

    console.log("[LOG] --- 6. CALLING RE-RANKER ---");
    const rerankResult = await generateWithRetry(rerankPrompt);
    const rerankResponse = rerankResult.response;
    const rerankText = rerankResponse.text();
    console.log(`[LOG] --- 7. Re-ranker Raw Output: ${rerankText} ---`);
    
    let relevantIndices = [];
    try {
        const jsonString = rerankText.match(/\[(.*?)\]/)[0];
        relevantIndices = JSON.parse(jsonString);
    } catch (e) {
        console.warn("[LOG] Could not parse re-ranker JSON, using fallback.", e.message);
        relevantIndices = [0, 1, 2].slice(0, initialResults.documents[0].length); 
    }
    console.log(`[LOG] --- 8. Parsed Relevant Indices:`, relevantIndices, `---`);

    const relevantSources = relevantIndices.map(index => {
        if (initialResults.documents[0][index] && initialResults.metadatas[0][index]) {
            return {
                text: initialResults.documents[0][index],
                metadata: initialResults.metadatas[0][index]
            };
        }
        return null;
    }).filter(Boolean);
    console.log(`[LOG] --- 9. Final Relevant Sources Count: ${relevantSources.length} ---`);

    const labeledContext = relevantSources.length > 0
        ? relevantSources.map(source => `[Source from Document ID ${source.metadata.documentId}, Page ${source.metadata.pageNumber}]:\n${source.text}`).join('\n---\n')
        : "No relevant document chunks were found for this query.";

    const finalPrompt = `You are a helpful AI assistant named VAULT. Use the provided context to answer the user's question.

    - Answer based ONLY on the Labeled Retrieved Context.
    - If the context is empty or doesn't contain the answer, state that you couldn't find the information in the documents.
    - Be conversational and synthesize information from multiple sources if necessary.
    
    Context:
    ${labeledContext}
    ---
    User's Original Question: ${queryText}
    ---
    Answer:`;
    
    console.log("[LOG] --- 10. CALLING FINAL ANSWER SYNTHESIZER ---");
    const finalResult = await generateWithRetry(finalPrompt);
    const finalResponse = finalResult.response;
    const answer = finalResponse.text();
    console.log(`[LOG] --- 11. Final Answer from Gemini: "${answer.substring(0, 100)}..." ---`);

    const finalPayload = {
        answer: answer,
        sources: relevantSources
    };
    
    console.log("[LOG] --- 12. RETURNING FINAL PAYLOAD FROM performRAG ---");
    return finalPayload;
}

module.exports = { performRAG };