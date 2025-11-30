// backend/services/GenerationService.js
// --------------------------------------------------------
// [LOGGING] Enhanced with Stream Flow Tracking
// --------------------------------------------------------

const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
require('dotenv').config();

// Import Prompt Templates
const {
    getTransformQueryPrompt,
    getRerankPrompt,
    getFinalAnswerPrompt,
    getMetadataAnswerPrompt,
    getTitleGenerationPrompt
} = require('../utils/promptTemplates');

const SERVICE_NAME = 'GenerationService';

// --- 1. CLIENT INITIALIZATION ---

// Client A: Groq (Standard Workhorse - Tier 1)
const groqClient = new OpenAI({
    baseURL: process.env.FAST_LLM_BASE_URL,
    apiKey: process.env.FAST_LLM_API_KEY
});

// Client B: Google Gemini (Deep Reader - Tier 2)
const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const googleModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// Client C: Anthropic (Deep Thinker - Tier 3)
const anthropicClient = process.env.ANTHROPIC_API_KEY ? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
}) : null;


/**
 * [ROUTER] Selects the best AI for the job.
 */
function getClientConfig(mode) {
    // 1. SEQUENTIAL READ -> GOOGLE GEMINI
    if (mode === 'SEQUENTIAL' || mode === 'DEEP_READ') {
        if (!googleModel) {
            logger.warn(SERVICE_NAME, "Google Key missing! Falling back to Groq.");
            return { type: 'groq', client: groqClient, model: process.env.FAST_LLM_MODEL, maxTokens: 2048 };
        }
        // Google handles tokens dynamically, but we aim for long context
        return { type: 'google', client: googleModel, maxTokens: 8192 };
    }

    // 2. DEEP THINK -> ANTHROPIC CLAUDE
    if (mode === 'DEEP_THINK') {
        if (!anthropicClient) {
            logger.warn(SERVICE_NAME, "Anthropic Key missing! Falling back to Groq.");
            return { type: 'groq', client: groqClient, model: process.env.FAST_LLM_MODEL, maxTokens: 2048 };
        }
        return { type: 'anthropic', client: anthropicClient, model: 'claude-3-5-sonnet-20240620', maxTokens: 4096 };
    }

    // 3. STANDARD -> GROQ
    return {
        type: 'groq',
        client: groqClient,
        model: process.env.FAST_LLM_MODEL || "llama-3.1-8b-instant",
        maxTokens: 1024 // Keep short for standard chat
    };
}

// --- 2. UNIFIED STREAMING ENGINE ---

async function* generateStreamingResponse(messages, mode, temperature = 0.3) {
    const config = getClientConfig(mode);
    logger.info(SERVICE_NAME, `[STREAM_START] Routing '${mode}' request to provider: ${config.type.toUpperCase()}`);

    let chunkCount = 0;
    let firstChunkLogged = false;

    try {
        // --- OPTION A: GOOGLE GEMINI (Robust Concatenation) ---
        if (config.type === 'google') {
            // Google works best with a single prompt string for context-heavy tasks
            const systemContent = messages.find(m => m.role === 'system')?.content || "";
            const userContent = messages.find(m => m.role === 'user')?.content || "";
            const combinedPrompt = `${systemContent}\n\n----------------\n\n${userContent}`.trim();

            const result = await config.client.generateContentStream(combinedPrompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    if (!firstChunkLogged) {
                        logger.debug(SERVICE_NAME, `[STREAM_FLOW] Provider ${config.type} yielded FIRST chunk.`);
                        firstChunkLogged = true;
                    }
                    chunkCount++;
                    yield chunkText;
                }
            }
        }
        // --- OPTION B: ANTHROPIC ---
        else if (config.type === 'anthropic') {
            const stream = await config.client.messages.create({
                model: config.model,
                max_tokens: config.maxTokens,
                temperature: temperature,
                messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
                system: messages.find(m => m.role === 'system')?.content || "",
                stream: true,
            });

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta') {
                    if (!firstChunkLogged) {
                        logger.debug(SERVICE_NAME, `[STREAM_FLOW] Provider ${config.type} yielded FIRST chunk.`);
                        firstChunkLogged = true;
                    }
                    chunkCount++;
                    yield chunk.delta.text;
                }
            }
        }
        // --- OPTION C: GROQ (OpenAI Compatible) ---
        else {
            const stream = await config.client.chat.completions.create({
                messages: messages,
                model: config.model,
                max_tokens: config.maxTokens,
                temperature: temperature,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    if (!firstChunkLogged) {
                        logger.debug(SERVICE_NAME, `[STREAM_FLOW] Provider ${config.type} yielded FIRST chunk.`);
                        firstChunkLogged = true;
                    }
                    chunkCount++;
                    yield content;
                }
            }
        }

        logger.debug(SERVICE_NAME, `[STREAM_END] Provider ${config.type} finished. Total chunks: ${chunkCount}`);

    } catch (error) {
        logger.error(SERVICE_NAME, `[STREAM_ERROR] Provider '${config.type}' failed: ${error.message}`, error);
        // Return a safe fallback message to the UI
        yield `System Alert: The AI provider (${config.type}) is currently unavailable. Please try again in a moment.`;
    }
}

/**
 * Non-streaming helper.
 */
async function generateSingleResponse(messages, mode = 'STANDARD') {
    let fullText = "";
    try {
        const stream = generateStreamingResponse(messages, mode, 0.1);
        for await (const chunk of stream) {
            fullText += chunk;
        }
        return fullText;
    } catch (e) {
        logger.error(SERVICE_NAME, `[SINGLE_RESP_ERROR] ${e.message}`);
        return "";
    }
}

// --- 3. AGENT LOGIC ---

async function classifyQuery(userQuery, userRole, currentMode) {
    let docFilter = null;
    const quoteMatch = userQuery.match(/"([^"]+)"/);
    const fileMention = userQuery.match(/(?:in|from|about)\s+(?:the\s+)?(?:document|file|report)\s+([A-Za-z0-9_\-\.]+)/i);

    if (quoteMatch) docFilter = quoteMatch[1];
    else if (fileMention) docFilter = fileMention[1];

    let queryType = 'VECTOR_RAG';
    const lower = userQuery.toLowerCase();

    if (lower.includes('select *') || lower.includes('show me logs')) queryType = 'SQL_METADATA';
    else if (['hi', 'hello', 'help'].includes(lower.trim())) queryType = 'LLM';

    let chatMode = currentMode;
    if (lower.includes('think') || lower.includes('reason')) chatMode = 'DEEP_THINK';

    let actionType = null;
    if (lower.includes('create tasks') || lower.includes('asana')) {
        actionType = 'CREATE_TASKS';
        queryType = 'ACTION';
    }

    return { queryType, chatMode, documentFilter: docFilter, actionType, sql: null };
}

async function transformQuery(query, candidateDocNames, mode) {
    if (mode === 'STANDARD') return query;
    const messages = getTransformQueryPrompt(query, candidateDocNames);
    const rephrased = await generateSingleResponse(messages, 'STANDARD');
    return rephrased.replace(/^"|"$/g, '').trim() || query;
}

async function rerankChunks(query, chunks, mode) {
    if (chunks.length <= 5) return chunks.map((_, i) => i);

    const rawPrompt = getRerankPrompt(query, chunks);
    let messages = [];

    // [FIX] Wrap string prompt into array format
    if (typeof rawPrompt === 'string') {
        messages = [
            { role: "system", content: "You are a relevance ranker. Return ONLY a JSON array of indices." },
            { role: "user", content: rawPrompt }
        ];
    } else {
        messages = rawPrompt;
    }

    try {
        // Use STANDARD mode (Groq) for speed
        const response = await generateSingleResponse(messages, 'STANDARD');
        const matches = response.match(/\[.*?\]/);
        return matches ? JSON.parse(matches[0]) : [0, 1, 2, 3, 4];
    } catch (e) {
        logger.warn(SERVICE_NAME, `[RERANK_FAIL] ${e.message}. Fallback to default.`);
        return [0, 1, 2, 3, 4]; // Fallback
    }
}

async function executeMath(expression, mode) {
    try {
        const cleanExpr = expression.replace(/```/g, '').replace(/javascript/g, '').trim();
        return Function('"use strict";return (' + cleanExpr + ')')();
    } catch (e) { return null; }
}

async function extractMathExpression(query, sources) { return null; }

// --- 4. FINAL SYNTHESIS ---

async function* streamFinalAnswer(context, query, chatMode, mathResults) {
    logger.info(SERVICE_NAME, `[SYNTHESIS] Generating answer via ${chatMode} mode.`);

    const templateOutput = getFinalAnswerPrompt(context, query, chatMode, mathResults);
    let messages = [];

    if (typeof templateOutput === 'string') {
        messages = [
            { role: "system", content: templateOutput },
            { role: "user", content: `User Query: ${query}` }
        ];
    } else if (Array.isArray(templateOutput)) {
        messages = templateOutput;
    } else {
        yield "Internal Prompt Error.";
        return;
    }

    const stream = generateStreamingResponse(messages, chatMode, 0.2);
    for await (const chunk of stream) {
        yield chunk;
    }
}

async function* streamMetadataAnswer(query, data, mode) {
    const rawPromptString = getMetadataAnswerPrompt(query, data, mode);
    const messages = [
        { role: "system", content: "You are a SQL Data Reporter." },
        { role: "user", content: rawPromptString }
    ];
    const stream = generateStreamingResponse(messages, mode);
    for await (const chunk of stream) {
        yield chunk;
    }
}

async function generateTitle(userMessage, aiMessage) {
    logger.info(SERVICE_NAME, '[TITLE] Generating conversation title...');

    const rawPrompt = getTitleGenerationPrompt(userMessage, aiMessage);
    let messages = [];

    if (typeof rawPrompt === 'string') {
        messages = [
            { role: "system", content: "You are a helpful assistant. Generate a short, 3-5 word title for this chat." },
            { role: "user", content: rawPrompt }
        ];
    } else if (Array.isArray(rawPrompt)) {
        messages = rawPrompt;
    } else {
        messages = [{ role: "user", content: `Generate a title for this chat:\nUser: ${userMessage}\nAI: ${aiMessage}` }];
    }

    try {
        const title = await generateSingleResponse(messages, 'STANDARD');
        return title.trim().replace(/^"|"$/g, '') || "New Chat";
    } catch (error) {
        logger.error(SERVICE_NAME, `[TITLE_FAIL] ${error.message}`);
        return "New Chat";
    }
}

module.exports = {
    classifyQuery,
    transformQuery,
    rerankChunks,
    extractMathExpression,
    executeMath,
    streamFinalAnswer,
    streamMetadataAnswer,
    generateStreamingResponse,
    generateTitle
};