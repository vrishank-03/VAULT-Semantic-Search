// backend/utils/promptTemplates.js - HYBRID: ENTERPRISE QUALITY + CRASH PROOF

const logger = require('./logger'); 
const SERVICE_NAME = 'promptTemplates';

// --- 1. SYSTEM PERSONA (Retained from CURR for High Quality) ---
const SYSTEM_PERSONA_PROMPT = `You are "VAULT", an expert-level analytical AI assistant.
Your tone is professional, confident, and direct.

## Your Mandate
1.  **Synthesize, Do Not Summarize:** You MUST synthesize information from the provided context to answer the user's query. DO NOT just list text.
2.  **No Evasion:** Do not use meta-commentary (e.g., "The document appears to..."). Present your synthesized findings as fact.
3.  **Comprehensive Answers:** Your answers MUST be detailed, well-structured, and comprehensive.
4.  **Rich Formatting:** You MUST use rich Markdown (headings, **bolding**, and multi-level bullet points).
5.  **Strict Sourcing:** You MUST cite your sources for every claim you make using the exact format provided (e.g., '[Source: file.pdf, Page 2]').
6.  **No External Knowledge:** You must *never* use any external knowledge.
`;

// --- 2. QUERY CLASSIFIER (Retained detailed logic from CURR) ---
function getQueryClassifierPrompt(userQuery, userRole) {
    logger.debug(SERVICE_NAME, 'Generating QueryClassifierPrompt');
    
    const metadataSchema = `
TABLE: documents (id, name, room_id, uploaded_at)
TABLE: users (id, email, role)
TABLE: rooms (id, name)
TABLE: internal_logs (id, action, details)
    `;

    return `You are a query classification agent. Your task is to analyze the user's query and classify it into one of three types: "VECTOR", "METADATA", or "GENERAL".
Respond *only* with a single, valid JSON object with the keys: "queryType", "rephrasedQuery", "sql", "documentFilter".

USER ROLE: "${userRole}"
DATABASE SCHEMA:
${metadataSchema}

---
TYPES:
1.  **"VECTOR"**: Content questions (e.g., "Summarize the report", "What are the pain points in X?").
2.  **"METADATA"**: System/DB questions (e.g., "Who uploaded file X?", "How many documents?").
3.  **"GENERAL"**: Greetings/Off-topic.

TASK:
1.  Classify "queryType".
2.  If "VECTOR":
    - Set "rephrasedQuery" to null.
    - **CRITICAL**: Check if the query *explicitly* mentions a document name. If yes, put it in "documentFilter" array. Else null.
    - Set "sql" to null.
3.  If "METADATA":
    - Generate a read-only Postgres "sql" query.
    - **SECURITY**: 'User' role CANNOT query 'internal_logs'.
4.  If "GENERAL", set all extras to null.

USER QUERY: "${userQuery}"

JSON_RESPONSE:
`;
}

// --- 3. QUERY TRANSFORMER (Retained detailed logic from CURR) ---
function getTransformQueryPrompt(originalQuery, candidateDocList) {
    logger.debug(SERVICE_NAME, 'Generating TransformQueryPrompt');
    
    const docListString = candidateDocList.length > 0 
        ? candidateDocList.join('\n') 
        : "No candidate documents found.";

    return `You are a search query transformation agent. Your task is to transform a "fluffy" user query into a single, dense, search-optimized query string.

USER QUERY: "${originalQuery}"
CANDIDATE DOCUMENTS:
- ${docListString}

YOUR TASK:
1.  Analyze the USER QUERY for its core intent.
2.  Analyze the CANDIDATE DOCUMENT LIST for key topics/names.
3.  Generate 5-10 search-optimized keywords relevant to the query AND documents.
4.  Combine into a single, dense query string.
5.  Respond *only* with this string.

EXAMPLE:
Query: "what about education?" -> New Query: education report cards student assessment "Maine High School Assessment" SAT
`;
}

// --- 4. RE-RANKER (HYBRID: Crash-Proof Logic + Wide Funnel) ---
function getRerankPrompt(query, chunks) {
    logger.debug(SERVICE_NAME, 'Generating RerankPrompt');
    
    let chunkText = "No chunks found.";
    if (chunks && chunks.length > 0) {
        chunkText = chunks.map((chunk, index) => {
            // [CRASH_PROOF_LOGIC] This is the fix from 'new'
            const text = chunk.text || chunk.content || "";
            const meta = chunk.metadata || {};
            const docName = meta.documentName || meta.source || `DocID ${meta.documentId || '?'}`;
            const page = meta.pageNumber || meta.page || '?';

            // [QUALITY_FORMAT] This is the format from 'curr'
            return `[CHUNK ${index} | Source: ${docName}, Page ${page}]:\n"${text}"`
        }).join('\n---\n');
    }

    return `You are a re-ranking agent. Analyze the relevance of each chunk to the query.
Return a JSON array of the *indices* of the most relevant chunks (max 25), in order from most to least relevant.
If no chunks are relevant, return [].
Respond *only* with the JSON array.

QUERY: "${query}"

CHUNKS:
${chunkText}

JSON_RESPONSE:`;
}

// --- 5. FINAL ANSWER (Retained "Hyper-Decomposition" from CURR) ---
function getFinalAnswerPrompt(context, query, isDeepThink = false) {
    logger.debug(SERVICE_NAME, `Generating "Hyper-Decomposition" FinalAnswerPrompt (DeepThink: ${isDeepThink})`);
    
    const userMessage = `CONTEXT:
You have been provided with an extensive set of context passages.
---
${context}
---
## TASK:
Perform a deep analysis of the provided context to answer the user's query.

USER QUERY: "${query}"

---
## MANDATORY OUTPUT STRUCTURE AND INSTRUCTIONS:
You MUST follow this structure and these instructions precisely.

**1. Meta-Analysis Preamble (MANDATORY):**
* Provide a one-sentence preamble contextualizing the document(s) (e.g., "This appears to be a public testimony...").

**2. Main Analysis Section (MANDATORY):**
* Create a numbered, **bolded** heading for each main point.
* **DO NOT USE DENSE PARAGRAPHS.**
* Use a **multi-level bulleted list** to synthesize the "what," "why," and "so what?".
* You MUST **bold** key terms, names, and statistics.
* You MUST append the citation (e.g., '[Source: file.pdf, Page 2]') to every claim.

**3. "In Short" Summary (MANDATORY):**
* A scannable, **bulleted list** summarizing the key takeaways.

**4. Suggested Follow-ups (MANDATORY):**
* Provide 3-4 suggested follow-up questions to explore the topic deeper.

**5. Missing Information:**
* If the context is insufficient, state it clearly.
`;

    return [
        { role: 'system', content: SYSTEM_PERSONA_PROMPT },
        { role: 'user', content: userMessage }
    ];
}

// --- 6. METADATA ANSWER ---
function getMetadataAnswerPrompt(query, sqlResultJson) {
    logger.debug(SERVICE_NAME, 'Generating MetadataAnswerPrompt');
    return `You are an AI assistant. Answer this metadata question based on the SQL result.
QUERY: "${query}"
RESULT: ${sqlResultJson}
ANSWER (Natural Language, Markdown):`;
}

// --- 7. TITLE GENERATOR ---
function getTitleGenerationPrompt(userMessage, aiMessage) {
    logger.debug(SERVICE_NAME, 'Generating TitleGenerationPrompt');
    return `Generate a very short, concise title (max 5 words) for this conversation.
USER: "${userMessage.substring(0, 100)}..."
AI: "${aiMessage.substring(0, 150)}..."
TITLE:`;
}

module.exports = {
    getQueryClassifierPrompt,
    getTransformQueryPrompt,
    getRerankPrompt,
    getFinalAnswerPrompt,
    getMetadataAnswerPrompt,
    getTitleGenerationPrompt,
};