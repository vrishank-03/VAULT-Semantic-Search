const OpenAI = require('openai');
const { getEmbeddingForQuery } = require('./ml_runner');
// --- MODIFIED IMPORT: Added updateConversationTitle ---
const { getDb, chromaClient, updateConversationTitle } = require('./database');
const { v4: uuidv4 } = require('uuid');
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
            // Optional: Add temperature or max_tokens if needed for title generation
            // temperature: 0.5,
            // max_tokens: 15,
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

async function performRAG(userId, queryText, history = [], conversationId) {
    // --- (performRAG function remains largely the same until the end) ---
    console.log(`\n[LOG] --- 1. ENTERING performRAG for User ${userId} | Convo ID: ${conversationId} ---`);
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

    // --- Handling case where no results are found ---
    if (!initialResults || initialResults.documents.length === 0 || initialResults.documents[0].length === 0) {
        const noResultPayload = { answer: "I couldn't find any relevant information for that query in your documents.", sources: [] };
        // --- Try saving messages (which might generate title if it's the first message) ---
        await saveMessages(db, conversationId, queryText, noResultPayload.answer, noResultPayload, userId);
        console.log("[LOG] --- Returning early: No relevant chunks found ---");
        return noResultPayload;
    }

    // --- (Rest of RAG logic: Re-ranking, Final Prompt) ---
    const rerankPrompt = `You are a helpful and professional re-ranking assistant...`; // Unchanged

    console.log("[LOG] --- 6. CALLING RE-RANKER ---");
    const rerankResult = await generateWithGroq(rerankPrompt);
    const rerankResponse = rerankResult.response;
    const rerankText = rerankResponse.text();
    console.log(`[LOG] --- 7. Re-ranker Raw Output: ${rerankText} ---`);

    let relevantIndices = [];
    try {
        const jsonStringMatch = rerankText.match(/\[.*?\]/s);
        if (jsonStringMatch) {
            relevantIndices = JSON.parse(jsonStringMatch[0]);
        } else {
             throw new Error("No JSON array found in re-ranker output.");
        }
    } catch (e) {
        console.warn("[LOG] Could not parse re-ranker JSON, using fallback.", e.message);
        relevantIndices = [0, 1, 2].slice(0, initialResults.documents[0].length);
    }
    console.log(`[LOG] --- 8. Parsed Relevant Indices:`, relevantIndices, `---`);

    const relevantSources = relevantIndices.map(index => {
        // Ensure index is within bounds before accessing
        if (index >= 0 && initialResults.documents[0].length > index) {
            if (initialResults.documents[0][index] && initialResults.metadatas[0][index]) {
                return {
                    text: initialResults.documents[0][index],
                    metadata: initialResults.metadatas[0][index]
                };
            }
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

    // --- Save messages AFTER generating the final answer, pass userId ---
    await saveMessages(db, conversationId, queryText, finalPayload.answer, finalPayload, userId);

    console.log("[LOG] --- 13. RETURNING FINAL PAYLOAD FROM performRAG ---");
    return finalPayload;
}

// --- MODIFIED HELPER FUNCTION TO SAVE MESSAGES & GENERATE TITLE ---
async function saveMessages(db, conversationId, userMessage, aiMessage, aiResultsPayload, userId) {
     console.log(`[LOG] --- 12. ATTEMPTING TO SAVE MESSAGES to convo: ${conversationId} ---`);
    if (!conversationId) {
        console.warn("[LOG] --- 12a. No conversationId provided. Skipping message save. ---");
        return;
    }

    // Use db.get for single row queries, db.run for inserts/updates
    const dbGet = (sql, params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
    const dbRun = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
    });

    try {
        const userMessageId = uuidv4();
        const aiMessageId = uuidv4();
        const userSql = `INSERT INTO chat_history (message_id, conversation_id, sender, message) VALUES (?, ?, 'user', ?)`;
        const aiSql = `INSERT INTO chat_history (message_id, conversation_id, sender, message, results) VALUES (?, ?, 'ai', ?, ?)`;
        const resultsJson = aiResultsPayload ? JSON.stringify(aiResultsPayload) : null;

        console.log(`[LOG] --- 12b. Saving user message: ${userMessageId}`);
        await dbRun(userSql, [userMessageId, conversationId, userMessage]);
        console.log(`[DB_SAVE_MSG_SUCCESS] Saved user message ${userMessageId}.`);

        console.log(`[LOG] --- 12c. Saving AI message: ${aiMessageId}`);
        await dbRun(aiSql, [aiMessageId, conversationId, aiMessage, resultsJson]);
        console.log(`[DB_SAVE_MSG_SUCCESS] Saved AI message ${aiMessageId}.`);

        console.log(`[LOG] --- 12d. Successfully saved user and AI messages.`);

        // --- TITLE GENERATION LOGIC ---
        console.log(`[LOG] --- 12e. Checking if title needs generation for convo ${conversationId}...`);
        // Check if exactly 2 messages exist (the ones just saved)
        const countSql = `SELECT COUNT(*) as count FROM chat_history WHERE conversation_id = ?`;
        const countResult = await dbGet(countSql, [conversationId]);

        if (countResult && countResult.count === 2) {
            console.log(`[LOG] --- 12f. First exchange detected. Checking current title...`);
            // Check if title is still the default "New Chat"
            const titleSql = `SELECT title FROM conversations WHERE conversation_id = ? AND user_id = ?`;
            const convoData = await dbGet(titleSql, [conversationId, userId]);

            if (convoData && convoData.title === "New Chat") {
                console.log(`[LOG] --- 12g. Title is default. Generating new title...`);

                const titleGenPrompt = `Based on the following user query and AI response, generate a very concise title (3-5 words) suitable for a chat history list. Output only the title, without any extra text or quotation marks.

User Query: "${userMessage}"
AI Response: "${aiMessage.substring(0, 200)}..."`; // Limit AI response length for prompt

                try {
                    const titleResult = await generateWithGroq([{ role: 'user', content: titleGenPrompt }]);
                    let generatedTitle = titleResult.response.text().trim();
                    // Basic cleanup: remove surrounding quotes if present
                    if (generatedTitle.startsWith('"') && generatedTitle.endsWith('"')) {
                        generatedTitle = generatedTitle.substring(1, generatedTitle.length - 1);
                    }
                     // Ensure title isn't empty after cleanup
                    if (generatedTitle.length === 0) {
                        generatedTitle = "Chat Summary"; // Fallback title
                        console.warn(`[LOG_WARN] --- Generated title was empty, using fallback.`);
                    }
                    console.log(`[LOG] --- 12h. Generated Title: "${generatedTitle}"`);

                    // Update the title in the database
                    await updateConversationTitle(conversationId, generatedTitle);

                } catch (titleGenError) {
                    console.error(`[LOG_ERROR] --- 12i. Failed to generate or save title:`, titleGenError);
                    // Don't block the main RAG process if title generation fails
                }
            } else {
                 console.log(`[LOG] --- Title already set or conversation not found: "${convoData ? convoData.title : 'Not Found'}"`);
            }
        } else {
            console.log(`[LOG] --- Not the first exchange (message count: ${countResult ? countResult.count : 'Error'}). Skipping title generation.`);
        }
        // --- END TITLE GENERATION LOGIC ---

    } catch (dbError) {
        console.error("[LOG_ERROR] --- Failed during message saving or title generation process:", dbError.message);
        // Do not throw; allow RAG to return the answer
    }
}


module.exports = { performRAG };