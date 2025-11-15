// backend/services/GenerationService.js

const OpenAI = require('openai');
const logger = require('../utils/logger');
const {
    getQueryClassifierPrompt,
    getRerankPrompt,
    getFinalAnswerPrompt,
    getMetadataAnswerPrompt,
    getTitleGenerationPrompt,
} = require('../utils/promptTemplates');
require('dotenv').config();

const SERVICE_NAME = 'GenerationService';

const groq = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_MODEL = 'llama-3.1-8b-instant'; 
const DEEP_THINK_MODEL = 'llama-3.3-70b-versatile'; 

function selectModel(modelName = 'auto', isDeepThink = false) {
    if (modelName !== 'auto') {
        logger.debug(SERVICE_NAME, `User selected specific model: ${modelName}`);
        return modelName;
    }
    if (isDeepThink) {
        logger.debug(SERVICE_NAME, `Auto-selecting "Deep Think" model: ${DEEP_THINK_MODEL}`);
        return DEEP_THINK_MODEL;
    }
    logger.debug(SERVICE_NAME, `Auto-selecting default model: ${DEFAULT_MODEL}`);
    return DEFAULT_MODEL;
}

async function* generateStreamingResponse(promptOrMessages, model, temperature = 0.5, max_tokens = null) {
    logger.debug(SERVICE_NAME, `Calling Groq (Streaming) with model: ${model}`);
    try {
        const messages = Array.isArray(promptOrMessages)
            ? promptOrMessages
            : [{ role: 'user', content: promptOrMessages }];

        const options = {
            messages: messages,
            model: model,
            temperature: temperature,
            stream: true,
        };
        if (max_tokens) {
            options.max_tokens = max_tokens;
        }

        const stream = await groq.chat.completions.create(options);
        
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                yield content;
            }
        }
        logger.debug(SERVICE_NAME, `Groq stream finished for model: ${model}`);

    } catch (error) {
        logger.error(SERVICE_NAME, `Groq (Streaming) API Error: ${error.message}`, error);
        throw new Error("Failed to generate streaming content from Groq API.");
    }
}

async function generateSingleResponse(promptOrMessages, model, temperature = 0.2, max_tokens = 1024) {
    logger.debug(SERVICE_NAME, `Calling Groq (Single) with model: ${model}`);
    let fullResponse = "";
    try {
        const stream = generateStreamingResponse(promptOrMessages, model, temperature, max_tokens);
        for await (const chunk of stream) {
            fullResponse += chunk;
        }
        logger.debug(SERVICE_NAME, `Groq (Single) successful. Output: "${fullResponse.substring(0, 50)}..."`);
        return fullResponse;

    } catch (error) {
        logger.error(SERVICE_NAME, `Groq (Single) API Error: ${error.message}`, error);
        throw new Error("Failed to generate single response from Groq API.");
    }
}

// --- 1. Query Classifier (Agent Brain) ---
async function classifyQuery(userQuery, userRole, docList) {
    logger.info(SERVICE_NAME, 'Generating query classification...');
    const prompt = getQueryClassifierPrompt(userQuery, userRole, docList);
    const rawOutput = await generateSingleResponse(prompt, DEFAULT_MODEL, 0.1, 1024); // Increased tokens for long doc lists
    
    try {
        const jsonStringMatch = rawOutput.match(/\{[\s\S]*\}/);
        if (!jsonStringMatch) {
            throw new Error("No JSON object found in classifier output.");
        }
        const classification = JSON.parse(jsonStringMatch[0]);
        
        // Ensure all keys are present
        const validatedClassification = {
            queryType: classification.queryType || 'GENERAL',
            rephrasedQuery: classification.rephrasedQuery || userQuery,
            sql: classification.sql || null,
            documentFilter: classification.documentFilter || null // [SCOPED_SEARCH_FIX]
        };

        logger.info(SERVICE_NAME, 'Query classification successful:', validatedClassification);
        return validatedClassification;
    } catch (e) {
        logger.error(SERVICE_NAME, `Failed to parse classifier JSON: ${e.message}. Raw: ${rawOutput}`);
        
        // [SCOPED_SEARCH_FIX] Add documentFilter: null to the fallback
        return {
            queryType: "VECTOR",
            rephrasedQuery: userQuery,
            sql: null,
            documentFilter: null
        };
    }
}

// --- 2. Re-rank Chunks ---
async function rerankChunks(query, chunks) {
    logger.info(SERVICE_NAME, 'Generating re-ranked indices...');
    const prompt = getRerankPrompt(query, chunks);
    const rawOutput = await generateSingleResponse(prompt, DEFAULT_MODEL, 0.1, 256);
    
    logger.debug(SERVICE_NAME, `Re-ranker Raw Output: ${rawOutput}`);
    try {
        const jsonStringMatch = rawOutput.match(/\[[\s\S]*?\]/s);
        if (jsonStringMatch) {
            return JSON.parse(jsonStringMatch[0]);
        }
        throw new Error("No JSON array found in re-ranker output.");
    } catch (e) {
        logger.warn(SERVICE_NAME, `Could not parse re-ranker JSON, using fallback. Error: ${e.message}`);
        return [0, 1, 2].slice(0, chunks.length);
    }
}

// --- 3. Generate Final RAG Answer (STREAMING) ---
function streamFinalAnswer(context, query, modelName, isDeepThink) {
    logger.info(SERVICE_NAME, `Generating final answer (Streaming, DeepThink: ${isDeepThink})...`);
    const messages = getFinalAnswerPrompt(context, query, isDeepThink);
    const model = selectModel(modelName, isDeepThink);
    return generateStreamingResponse(messages, model, 0.5, 2048); 
}

// --- 4. Generate Metadata Answer (STREAMING) ---
function streamMetadataAnswer(query, sqlResultJson, modelName) {
    logger.info(SERVICE_NAME, 'Generating metadata answer (Streaming)...');
    const prompt = getMetadataAnswerPrompt(query, sqlResultJson);
    const model = selectModel(modelName, false);
    return generateStreamingResponse(prompt, model, 0.5, 1024);
}

// --- 5. Generate Title (SINGLE) ---
async function generateTitle(userMessage, aiMessage) {
    logger.info(SERVICE_NAME, 'Generating conversation title...');
    const prompt = getTitleGenerationPrompt(userMessage, aiMessage);
    try {
        const rawTitle = await generateSingleResponse(prompt, DEFAULT_MODEL, 0.5, 15);
        
        let generatedTitle = rawTitle.trim().replace(/^"|"$/g, '');
        if (generatedTitle.length === 0) {
            generatedTitle = "Chat Summary";
            logger.warn(SERVICE_NAME, 'Generated title was empty, using fallback.');
        }
        
        logger.info(SERVICE_NAME, `Generated Title: "${generatedTitle}"`);
        return generatedTitle;
    } catch (titleGenError) {
        logger.error(SERVICE_NAME, 'Failed to generate title', titleGenError);
        return "Chat Summary";
    }
}

module.exports = {
    classifyQuery,
    rerankChunks,
    streamFinalAnswer,
    streamMetadataAnswer,
    generateTitle,
};