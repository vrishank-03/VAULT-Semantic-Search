// backend/utils/promptTemplates.js

const logger = require('./logger'); // [FIX] Corrected relative path
const SERVICE_NAME = 'promptTemplates';

// --- 1. SYSTEM PERSONA (Used in Final RAG Answer) ---
const SYSTEM_PERSONA_PROMPT = `You are "VAULT", a professional, analytical AI assistant.
- Your primary goal is to provide accurate, relevant, and comprehensive answers by **synthesizing, reasoning over, and inferring from** the provided context.
- You must *never* use any external knowledge. All parts of your answer must be directly supported by the context.
- If the user's query truly cannot be answered *at all* by the context (e.g., they ask about a completely different topic), you must state that clearly.
- When answering, **do not just extract text**. Analyze the user's query and the context, and provide a direct, synthesized answer.
- You must cite your sources meticulously.
- When you use information from a source, you *must* append a citation placeholder *exactly* as it was given to you in the context, like: [Source from Document ID 123, Page 2].
- Do not add conversational preambles like "Here is the answer:" or "Based on the context...". Just provide the direct answer.`;

// --- 2. QUERY CLASSIFIER (The "Agent" Brain) ---
/**
 * Creates the prompt for the SQL Agent / Query Classifier.
 * This is the *first* call in the pipeline to decide *what* to do.
 */
function getQueryClassifierPrompt(userQuery, userRole, docList) {
    logger.debug(SERVICE_NAME, 'Generating QueryClassifierPrompt');
    
    const docListString = docList.length > 0
        ? docList.map(doc => `- ${doc.name} (ID: ${doc.id})`).join('\n') // AI needs the *name*
        : "No documents found in this room.";

    const metadataSchema = `
TABLE: documents
COLUMNS: id (INTEGER), name (TEXT), room_id (INTEGER), uploaded_at (DATETIME), uploaded_by_user_id (INTEGER)
TABLE: users
COLUMNS: id (INTEGER), email (TEXT), role (TEXT), status (TEXT)
TABLE: rooms
COLUMNS: id (INTEGER), name (TEXT), created_at (DATETIME)
TABLE: room_access
COLUMNS: room_id (INTEGER), user_id (INTEGER), granted_at (DATETIME)
TABLE: internal_logs
COLUMNS: id (INTEGER), timestamp (DATETIME), user_id (INTEGER), action (TEXT), details (TEXT)
    `;

    return `You are a query classification agent. Your task is to analyze the user's query and classify it into one of three types: "VECTOR", "METADATA", or "GENERAL".
You must respond *only* with a single, valid JSON object with the keys: "queryType", "rephrasedQuery", "sql", "documentFilter".

USER ROLE: "${userRole}"

DATABASE SCHEMA:
${metadataSchema}

DOCUMENT LIST:
${docListString}

---
Here are the query types:

1.  **"VECTOR"**: The query is about the *content* of one or more documents.
    - Example: "What are the basal requirements?"
    - Example: "Summarize the pain points in the project."
    - Example: "what are the pain points in 4MXIGGV3UCFRYPPPQ4LGGB27K42PFGQV.pdf document?"

2.  **"METADATA"**: The query is about system metadata, logs, files, or users.
    - Example: "How many documents are in this room?"
    - Example: "Which user uploaded document 14?"
    - Example: "how many times did Siddhart log into XYZ room?"

3.  **"GENERAL"**: The query is a simple greeting or off-topic question.
    - Example: "Hello"

---
YOUR TASK:
Analyze the query below and generate the JSON response.
1.  Classify its "queryType".
2.  If the type is "VECTOR":
    - Set "rephrasedQuery" to a search-optimized version of the query.
    - **CRITICAL**: Check if the query mentions specific document names (like '4MX...pdf').
    - If it does, find the *exact* matching document names from the "DOCUMENT LIST" and put them in the "documentFilter" array (e.g., ["4MXIGGV3UCFRYPPPQ4LGGB27K42PFGQV.pdf"]).
    - If no specific documents are mentioned, set "documentFilter" to null.
    - Set "sql" to null.
3.  If the type is "METADATA":
    - You *must* generate a *read-only* (SELECT) SQLite query ("sql") to answer the question.
    - **SECURITY RULE**: 'User' role CANNOT query 'internal_logs'. If they try, set "sql" to "PERMISSION_DENIED".
    - Set "rephrasedQuery" and "documentFilter" to null.
4.  If the type is "GENERAL", set "rephrasedQuery", "sql", and "documentFilter" to null.

USER QUERY: "${userQuery}"

JSON_RESPONSE:
`;
}

// --- 3. RE-RANKER ---
function getRerankPrompt(query, chunks) {
    logger.debug(SERVICE_NAME, 'Generating RerankPrompt');
    
    let chunkText = "No chunks found.";
    if (chunks && chunks.length > 0) {
        chunkText = chunks.map((chunk, index) => {
            // Use camelCase to match our metadata
            return `[CHUNK ${index} | Doc ID ${chunk.metadata.documentId} | Page ${chunk.metadata.pageNumber}]:\n"${chunk.text}"`
        }).join('\n---\n');
    }

    return `You are a re-ranking agent. I have a query and several document chunks.
Your task is to analyze the relevance of each chunk to the query and return a JSON array of the *indices* of the most relevant chunks (max 5), in order from most to least relevant.
If no chunks are relevant, return an empty array [].
You must respond *only* with a single, valid JSON array and nothing else.

QUERY: "${query}"

CHUNKS:
${chunkText}

JSON_RESPONSE:`;
}

// --- 4. FINAL RAG ANSWER SYNTHESIZER (REASONING_FIX) ---
function getFinalAnswerPrompt(context, query, isDeepThink = false) {
    logger.debug(SERVICE_NAME, `Generating FinalAnswerPrompt (DeepThink: ${isDeepThink})`);
    
    let userMessage;
    
    if (isDeepThink) {
        userMessage = `CONTEXT:
${context}
---
TASK:
This is "Deep Thinking Mode". You must provide a highly detailed, comprehensive, and multi-paragraph response to the following query.
**Deeply analyze** the context above to provide the answer.
You must **synthesize** information from *all* relevant sources to build a complete picture.
If the query asks for information *not* present (e.g., "what does this document fail to cover?" or "what are the risks?"), you must first **state what the document *does* cover**, and then **use reasoning to infer** what is missing or implied.
Do not just list facts; explain *how* they connect.
You *must* cite every piece of information you use with its placeholder (e.g., [Source from Document ID 123, Page 2]).

QUERY: "${query}"`;
    } else {
        userMessage = `CONTEXT:
${context}
---
TASK:
**Deeply analyze** the context above to provide a concise and direct answer to the following query.
You must **synthesize** the answer, not just copy-paste text.
If the query asks for information *not* present (e.g., "what does this document fail to cover?"), you must first **state what the document *does* cover**, and then **use reasoning to infer** what is missing.
You *must* cite every piece of information you use with its placeholder (e.g., [Source from Document ID 123, Page 2]).

QUERY: "${query}"`;
    }

    return [
        {
            role: 'system',
            content: SYSTEM_PERSONA_PROMPT
        },
        {
            role: 'user',
            content: userMessage
        }
    ];
}

// --- 5. METADATA ANSWER SYNTHESIZER ---
function getMetadataAnswerPrompt(query, sqlResultJson) {
    logger.debug(SERVICE_NAME, 'Generating MetadataAnswerPrompt');

    return `You are an AI assistant. A user asked a question about system metadata, and I have run a SQL query to get the answer.
Your task is to take the user's query and the JSON result from the SQL query and provide a clear, natural language answer.
Do not mention SQL or databases. Just give the answer.

USER QUERY: "${query}"

JSON RESULT:
${sqlResultJson}

NATURAL LANGUAGE ANSWER:`;
}


// --- 6. TITLE GENERATOR ---
function getTitleGenerationPrompt(userMessage, aiMessage) {
    logger.debug(SERVICE_NAME, 'Generating TitleGenerationPrompt');
    
    return `Analyze the following user query and AI response.
Generate a very short, concise, and descriptive title for this conversation (max 5 words).
Respond *only* with the title text and nothing else (no quotes).

USER: "${userMessage.substring(0, 100)}..."
AI: "${aiMessage.substring(0, 150)}..."

TITLE:`;
}

module.exports = {
    getQueryClassifierPrompt,
    getRerankPrompt,
    getFinalAnswerPrompt,
    getMetadataAnswerPrompt,
    getTitleGenerationPrompt,
};