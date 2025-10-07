const OpenAI = require('openai');
const { getEmbeddingForQuery } = require('./ml_runner');
const { getDb, chromaClient } = require('./database');
require('dotenv').config();

// Initialize the Groq client
const groq = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
});

async function generateWithGroq(promptOrMessages) {
    try {
        const messages = Array.isArray(promptOrMessages)
            ? promptOrMessages
            : [{ role: 'user', content: promptOrMessages }];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: 'llama-3.1-8b-instant', 
        });

        const generatedText = chatCompletion.choices[0].message.content;

        return {
            response: {
                text: () => generatedText,
            },
        };
    } catch (error) {
        console.error("Groq API Error:", error);
        throw new Error("Failed to generate content from Groq API.");
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

    const queryAnalyzerPrompt = `You are an expert query analyzer...`; // Unchanged

    console.log("[LOG] --- 2. CALLING QUERY ANALYZER ---");
    const analyzerResult = await generateWithGroq(queryAnalyzerPrompt);
    const analyzerResponse = analyzerResult.response;
    const transformedQuery = analyzerResponse.text();
    console.log(`[LOG] --- 3. Query Analyzer Output: "${transformedQuery}" ---`);

    console.log("[LOG] --- 4. Retrieving embedding and querying ChromaDB ---");
    const queryEmbedding = await getEmbeddingForQuery(transformedQuery);
    
    const collection = await chromaClient.getOrCreateCollection({ name: "documents" });

    const initialResults = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 10,
        where: { "userId": userId }
    });
    console.log(`[LOG] --- 5. ChromaDB Retrieved ${initialResults?.documents?.[0]?.length || 0} chunks ---`);

    if (!initialResults || initialResults.documents.length === 0 || initialResults.documents[0].length === 0) {
        return { answer: "I couldn't find any relevant information for that query in your documents.", sources: [] };
    }

    const rerankPrompt = `You are a helpful and professional re-ranking assistant...`; // Unchanged

    console.log("[LOG] --- 6. CALLING RE-RANKER ---");
    const rerankResult = await generateWithGroq(rerankPrompt);
    const rerankResponse = rerankResult.response;
    const rerankText = rerankResponse.text();
    console.log(`[LOG] --- 7. Re-ranker Raw Output: ${rerankText} ---`);
    
    let relevantIndices = [];
    try {
        const jsonString = rerankText.match(/\[.*?\]/s)[0];
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

    const finalPromptMessages = [
        {
            role: 'system',
            // --- THIS IS THE FINAL FIX ---
            // A much more specific set of instructions, including an example,
            // to force the AI into the exact format you want.
            content: `You are a helpful AI assistant named VAULT. Your task is to answer the user's question based ONLY on the provided context.

- **CRITICAL FORMATTING RULE:** Structure your answer with an introductory sentence, followed by a list of key points. Each key point MUST start with a bolded title ending in a colon, followed by the explanation. You MUST separate each key point from the next with a double newline to create a clean paragraph break.

- **EXAMPLE OF THE REQUIRED FORMAT:**
Based on the provided context, the key takeaways are:

**Point One:** This is the explanation for the first point. It can be one or more sentences.

**Point Two:** This is the explanation for the second point. It must be separated from the first point by a blank line.

- If the context does not contain the answer, you must state that you couldn't find the information in the documents.
- Synthesize information from multiple sources if necessary.`
        },
        {
            role: 'user',
            content: `Context:\n---\n${labeledContext}\n---\n\nUser's Question: ${queryText}`
        }
    ];
    
    console.log("[LOG] --- 10. CALLING FINAL ANSWER SYNTHESIZER ---");
    const finalResult = await generateWithGroq(finalPromptMessages);
    const finalResponse = finalResult.response;
    const answer = finalResponse.text();
    console.log(`[LOG] --- 11. Final Answer from Groq: "${answer.substring(0, 100)}..." ---`);

    const finalPayload = {
        answer: answer,
        sources: relevantSources
    };
    
    console.log("[LOG] --- 12. RETURNING FINAL PAYLOAD FROM performRAG ---");
    return finalPayload;
}

module.exports = { performRAG };