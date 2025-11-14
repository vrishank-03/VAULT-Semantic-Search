// backend/services/GenerationService.js
// New File

const OpenAI = require('openai');
const logger = require('../utils/logger');
const {
    getQueryAnalyzerPrompt,
    getRerankPrompt,
    getFinalAnswerPrompt,
    getTitleGenerationPrompt,
} = require('../utils/promptTemplates');
require('dotenv').config();

const SERVICE_NAME = 'GenerationService';

// Initialize the Groq client
const groq = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Core function to call the Groq API.
 * @param {Array|string} promptOrMessages - A single prompt string or an array of message objects.
 * @param {string} model - The model to use (e.g., 'llama-3.1-8b-instant').
 * @param {number} [temperature=0.5] - Sampling temperature.
 * @param {number} [max_tokens] - Max tokens to generate.
 * @returns {Promise<string>} - The generated text content.
 */
async function generateWithGroq(promptOrMessages, model = 'llama-3.1-8b-instant', temperature = 0.5, max_tokens = null) {
    logger.debug(SERVICE_NAME, `Calling Groq with model: ${model}`);
    try {
        const messages = Array.isArray(promptOrMessages)
            ? promptOrMessages
            : [{ role: 'user', content: promptOrMessages }];

        const options = {
            messages: messages,
            model: model,
            temperature: temperature,
        };

        if (max_tokens) {
            options.max_tokens = max_tokens;
        }

        const chatCompletion = await groq.chat.completions.create(options);
        const generatedText = chatCompletion.choices[0].message.content;
        logger.debug(SERVICE_NAME, `Groq call successful. Output: "${generatedText.substring(0, 50)}..."`);
        return generatedText;

    } catch (error) {
        logger.error(SERVICE_NAME, `Groq API Error: ${error.message}`, error);
        throw new Error("Failed to generate content from Groq API.");
    }
}

// 1. Analyze Query
async function analyzeQuery(formattedHistory, docListString, queryText) {
    logger.info(SERVICE_NAME, 'Generating transformed search query...');
    const prompt = getQueryAnalyzerPrompt(formattedHistory, docListString, queryText);
    return await generateWithGroq(prompt, 'llama-3.1-8b-instant', 0.2); // Low temp for deterministic analysis
}

// 2. Re-rank Chunks
async function rerankChunks(query, chunks) {
    logger.info(SERVICE_NAME, 'Generating re-ranked indices...');
    const prompt = getRerankPrompt(query, chunks);
    const rawOutput = await generateWithGroq(prompt, 'llama-3.1-8b-instant', 0.1); // Low temp for JSON
    
    logger.debug(SERVICE_NAME, `Re-ranker Raw Output: ${rawOutput}`);
    try {
        const jsonStringMatch = rawOutput.match(/\[.*?\]/s);
        if (jsonStringMatch) {
            return JSON.parse(jsonStringMatch[0]);
        }
        throw new Error("No JSON array found in re-ranker output.");
    } catch (e) {
        logger.warn(SERVICE_NAME, `Could not parse re-ranker JSON, using fallback. Error: ${e.message}`);
        // Fallback: return top 3 indices
        return [0, 1, 2].slice(0, chunks.length);
    }
}

// 3. Generate Final Answer
async function generateFinalAnswer(labeledContext, queryText) {
    logger.info(SERVICE_NAME, 'Generating final synthesized answer...');
    const messages = getFinalAnswerPrompt(labeledContext, queryText);
    return await generateWithGroq(messages, 'llama-3.1-8b-instant', 0.5, 1024); // Standard temp, higher tokens
}

// 4. Generate Title
async function generateTitle(userMessage, aiMessage) {
    logger.info(SERVICE_NAME, 'Generating conversation title...');
    const prompt = getTitleGenerationPrompt(userMessage, aiMessage);
    try {
        const rawTitle = await generateWithGroq(prompt, 'llama-3.1-8b-instant', 0.5, 15); // Short, creative
        
        // Basic cleanup
        let generatedTitle = rawTitle.trim().replace(/^"|"$/g, ''); // Remove surrounding quotes
        if (generatedTitle.length === 0) {
            generatedTitle = "Chat Summary"; // Fallback
            logger.warn(SERVICE_NAME, 'Generated title was empty, using fallback.');
        }
        
        logger.info(SERVICE_NAME, `Generated Title: "${generatedTitle}"`);
        return generatedTitle;

    } catch (titleGenError) {
        logger.error(SERVICE_NAME, 'Failed to generate title', titleGenError);
        throw titleGenError; // Let the caller handle it
    }
}

module.exports = {
    generateWithGroq, // Exporting core function for any ad-hoc use
    analyzeQuery,
    rerankChunks,
    generateFinalAnswer,
    generateTitle,
};