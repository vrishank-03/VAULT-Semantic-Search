// backend/services/ChatHistoryService.js - OPTIMIZED for PostgreSQL and pg_trgm Fuzzy Search

const { query, executeTransaction } = require('../database'); 
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const GenerationService = require('./GenerationService'); // Ensure this import exists

const SERVICE_NAME = 'ChatHistoryService';

// --- Helper Functions ---

const updateConversationTitle = async (conversationId, newTitle) => {
    const sql = `UPDATE conversations SET title = $1 WHERE conversation_id = $2`;
    await query(sql, [newTitle, conversationId]);
    logger.debug(SERVICE_NAME, `Title updated to "${newTitle}" for convo ${conversationId}`);
};

/**
 * Saves user and AI messages to the database within a transaction (safe).
 * [CRITICAL FIX] Handles 'null' conversationId by creating a new conversation on the fly.
 */
async function saveMessages(conversationId, userId, userMessage, aiMessage, aiResultsPayload) {
    logger.info(SERVICE_NAME, `[SAVE] Saving messages. Requested ConvoID: ${conversationId}`);

    try {
        await executeTransaction(async (client) => {
            let targetConvoId = conversationId;

            // 1. Handle New Conversation (null or 'null' string)
            if (!targetConvoId || targetConvoId === 'null') {
                logger.info(SERVICE_NAME, '[SAVE] No valid conversation ID. Creating new conversation...');
                
                // Generate a Title (Async, but we await it to insert the row cleanly)
                let title = "New Chat";
                try {
                    title = await GenerationService.generateTitle(userMessage, aiMessage);
                } catch (e) {
                    logger.warn(SERVICE_NAME, '[SAVE] Title generation failed, using default.');
                }
                
                const newConvoId = uuidv4();
                
                // Insert new conversation row
                // NOTE: Assuming 'room_id' is 1 for now. Ideally, pass roomId to this function.
                const createSql = `INSERT INTO conversations (conversation_id, user_id, title, room_id) VALUES ($1, $2, $3, $4) RETURNING conversation_id`;
                const convoRes = await client.query(createSql, [newConvoId, userId, title, 1]);
                
                targetConvoId = convoRes.rows[0].conversation_id;
                logger.info(SERVICE_NAME, `[SAVE] Created new conversation: ${targetConvoId}`);
            }

            // 2. Save User Message
            const userMessageId = uuidv4();
            const userSql = `INSERT INTO chat_history (message_id, conversation_id, sender, message) VALUES ($1, $2, 'user', $3)`;
            await client.query(userSql, [userMessageId, targetConvoId, userMessage]);

            // 3. Save AI Message
            const aiMessageId = uuidv4();
            const resultsJson = aiResultsPayload ? JSON.stringify(aiResultsPayload) : null;
            const aiSql = `INSERT INTO chat_history (message_id, conversation_id, sender, message, results) VALUES ($1, $2, 'ai', $3, $4)`;
            await client.query(aiSql, [aiMessageId, targetConvoId, aiMessage, resultsJson]);
            
            logger.info(SERVICE_NAME, `[SAVE] Transaction complete. Messages saved to ${targetConvoId}`);
            
            // 4. Return the ID so the controller/frontend knows (if needed)
            return targetConvoId;
        });

    } catch (dbError) {
        logger.error(SERVICE_NAME, "[FATAL] Failed during message saving", dbError);
        // We log but do NOT throw, to prevent crashing the response stream if history fails.
    }
}

/**
 * Creates a new conversation (user and room scoped).
 */
async function createConversation(userId, roomId) {
    logger.info(SERVICE_NAME, `[CREATE] Creating new conversation for user ${userId} in room ${roomId}`);
    const conversationId = uuidv4();
    const title = "New Chat";

    const sql = `INSERT INTO conversations (conversation_id, user_id, title, room_id) VALUES ($1, $2, $3, $4) RETURNING *`;
    const params = [conversationId, userId, title, roomId];

    try {
        const res = await query(sql, params);
        logger.info(SERVICE_NAME, `[CREATE] Conversation ${conversationId} created.`);
        return res.rows[0]; 
    } catch (err) {
        logger.error(SERVICE_NAME, '[CREATE] Failed to insert new conversation', err);
        throw new Error('Failed to create conversation in database.');
    }
}

/**
 * Fetches all conversations for a user in a specific room.
 */
async function getConversations(userId, roomId) {
    logger.info(SERVICE_NAME, `[FETCH] Fetching conversations for user ${userId} in room ${roomId}`);
    const sql = `SELECT conversation_id, title, created_at, room_id 
                 FROM conversations 
                 WHERE user_id = $1 AND room_id = $2 
                 ORDER BY created_at DESC`;
    const params = [userId, roomId];

    try {
        const res = await query(sql, params);
        logger.info(SERVICE_NAME, `[FETCH] Found ${res.rows.length} conversations.`);
        return res.rows || [];
    } catch (err) {
        logger.error(SERVICE_NAME, '[FETCH] Failed to fetch conversations', err);
        throw new Error('Failed to fetch conversations from database.');
    }
}

/**
 * Fetches and parses the history for a single conversation.
 */
async function getConversationHistory(userId, conversationId) {
    logger.info(SERVICE_NAME, `[HISTORY] Fetching history for convo ${conversationId}`);

    try {
        const verifySql = `SELECT user_id FROM conversations WHERE conversation_id = $1 AND user_id = $2`;
        const verifyRes = await query(verifySql, [conversationId, userId]);

        if (verifyRes.rows.length === 0) {
            logger.warn(SERVICE_NAME, `[HISTORY] User ${userId} attempted to access unauthorized convo ${conversationId}.`);
            throw new Error('Access denied'); 
        }

        const historySql = `SELECT message_id, sender, message, results, timestamp 
                            FROM chat_history 
                            WHERE conversation_id = $1 
                            ORDER BY timestamp ASC`;
        const messages = (await query(historySql, [conversationId])).rows;

        const history = (messages || []).map(msg => {
            const messageData = {
                sender: msg.sender,
                text: msg.message
            };
            if (msg.sender === 'ai' && msg.results) {
                try {
                    messageData.results = (typeof msg.results === 'string') ? JSON.parse(msg.results) : msg.results;
                } catch (parseError) {
                    logger.error(SERVICE_NAME, `[HISTORY] Failed to parse results JSON for msg ${msg.message_id}`);
                    messageData.results = null; 
                }
            }
            return messageData;
        });

        logger.info(SERVICE_NAME, `[HISTORY] Found ${history.length} messages.`);
        return history;

    } catch (err) {
        logger.error(SERVICE_NAME, `[HISTORY] Error in getConversationHistory for ${conversationId}`, err);
        if (err.message === 'Access denied') throw err;
        throw new Error('Failed to fetch conversation history.');
    }
}

/**
 * Deletes a conversation and all associated history.
 */
async function deleteConversation(userId, conversationId) {
    logger.info(SERVICE_NAME, `[DELETE] Initiating deletion for convo ${conversationId} (User: ${userId})`);
    
    const sql = `
        DELETE FROM conversations 
        WHERE conversation_id = $1 AND user_id = $2
        RETURNING conversation_id;
    `;
    
    try {
        const res = await query(sql, [conversationId, userId]);
        if (res.rowCount === 0) {
            logger.warn(SERVICE_NAME, `[DELETE] No conversation found or user ${userId} denied deletion permission.`);
            return { success: false, message: 'Conversation not found or access denied.' };
        }
        logger.info(SERVICE_NAME, `[DELETE] Successfully deleted conversation ${conversationId}.`);
        return { success: true, message: 'Conversation deleted successfully.' };
    } catch (err) {
        logger.error(SERVICE_NAME, `[DELETE] Failed to delete conversation ${conversationId}`, err);
        throw new Error('Failed to delete conversation.');
    }
}

/**
 * Searches chat history using PostgreSQL's pg_trgm.
 */
async function searchChatHistory(userId, searchTerm) {
    logger.info(SERVICE_NAME, `[SEARCH] Initiating fuzzy search for user ${userId} with term: "${searchTerm}"`);

    const sql = `
        WITH UserConversations AS (
            SELECT conversation_id, title, room_id
            FROM conversations
            WHERE user_id = $1
        )
        SELECT
            uc.conversation_id,
            uc.title AS conversation_title,
            ch.message_id,
            ch.sender,
            ch.message,
            ch.timestamp,
            similarity(ch.message, $2) AS score
        FROM
            chat_history ch
        JOIN
            UserConversations uc ON ch.conversation_id = uc.conversation_id
        WHERE
            ch.sender = 'user' 
            AND ch.message % $2 
        ORDER BY
            score DESC, ch.timestamp DESC
        LIMIT 50;
    `;
    
    try {
        const res = await query(sql, [userId, searchTerm]);
        
        const groupedResults = res.rows.reduce((acc, row) => {
            if (!acc[row.conversation_id]) {
                acc[row.conversation_id] = {
                    conversation_id: row.conversation_id,
                    conversation_title: row.conversation_title,
                    matches: []
                };
            }
            acc[row.conversation_id].matches.push({
                message_id: row.message_id,
                sender: row.sender,
                text: row.message,
                timestamp: row.timestamp,
                score: row.score
            });
            return acc;
        }, {});

        return Object.values(groupedResults);

    } catch (err) {
        logger.error(SERVICE_NAME, `[SEARCH] Failed to search chat history`, err);
        throw new Error('Failed to perform chat history search.');
    }
}

module.exports = {
    saveMessages,
    createConversation,
    getConversations,
    getConversationHistory,
    deleteConversation,
    searchChatHistory,
};