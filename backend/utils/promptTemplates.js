// backend/utils/promptTemplates.js
// New File

/**
 * Centralized store for all RAG prompt templates.
 * This allows for easy tweaking of prompts without changing service logic.
 */

// 1. Query Analyzer Prompt
const getQueryAnalyzerPrompt = (formattedHistory, docListString, queryText) => {
    return `You are an expert query analyzer. The user is asking a question in a chat room.
You have access to the chat history and a list of documents in this specific room.
Your task is to analyze the user's *latest query* in the context of the history and available documents, then output a single, transformed search query.

1.  **If the query is self-contained** (e.g., "What is the capital of France?"), use the query as is.
2.  **If the query references history** (e.g., "What did it say about that?"), use the history to reformulate a standalone query (e.g., "What does the document say about [previous topic]?").
3.  **If the query is a general knowledge question NOT related to the documents**, transform it into a query about the documents (e.g., "Tell me what you know about [query topic]" or "Find information about [query topic] in the documents").
4.  **If no documents are available**, state that you cannot search for an answer.

**Chat History:**
${formattedHistory}

**Documents in this Room:**
${docListString}

**User's Latest Query:**
"${queryText}"

**Transformed Search Query:**`;
};

// 2. Re-ranking Prompt
const getRerankPrompt = (query, chunks) => {
    const contextChunks = chunks.map((chunk, index) =>
        `[Chunk ${index}]:\nDocument ID: ${chunk.metadata.documentId}\nPage: ${chunk.metadata.pageNumber}\nContent: ${chunk.text}\n---`
    ).join('\n');

    return `You are a helpful and professional re-ranking assistant. The user is asking a question and I have retrieved the top 10 potentially relevant chunks of text from a set of documents.
Your task is to analyze these chunks and identify the 3 *most* relevant ones that directly answer the user's query.

You must return your answer *only* as a JSON array of the top 3 indices.
Example: [0, 5, 2]

**User Query:**
"${query}"

**Retrieved Chunks:**
${contextChunks}

**Top 3 Most Relevant Indices (JSON Array):**`;
};

// 3. Final Answer Prompt
const getFinalAnswerPrompt = (labeledContext, queryText) => {
    return [
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
};

// 4. Title Generation Prompt
const getTitleGenerationPrompt = (userMessage, aiMessage) => {
    return `Based on the following user query and AI response, generate a very concise title (3-5 words) suitable for a chat history list. Output only the title, without any extra text or quotation marks.

User Query: "${userMessage}"
AI Response: "${aiMessage.substring(0, 200)}..."`;
};


module.exports = {
    getQueryAnalyzerPrompt,
    getRerankPrompt,
    getFinalAnswerPrompt,
    getTitleGenerationPrompt,
};