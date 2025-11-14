// backend/services/ChatHistoryService.js
// New File

const { getDb, updateConversationTitle } = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { generateTitle } = require('./GenerationService');

const SERVICE_NAME = 'ChatHistoryService';

// Helper for promise-based DB calls
const dbRun = (db, sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});
const dbGet = (db, sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbAll = (db, sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

/**
 * Saves user and AI messages to the database.
 * Triggers title generation if it's the first exchange.
 */
async function saveMessages(conversationId, userId, userMessage, aiMessage, aiResultsPayload) {
    logger.info(SERVICE_NAME, `Saving messages to convo: ${conversationId}`);
    if (!conversationId) {
        logger.warn(SERVICE_NAME, "No conversationId provided. Skipping message save.");
        return;
    }

    const db = getDb();
    try {
        // 1. Save Messages
        const userMessageId = uuidv4();
        const aiMessageId = uuidv4();
        const userSql = `INSERT INTO chat_history (message_id, conversation_id, sender, message) VALUES (?, ?, 'user', ?)`;
        const aiSql = `INSERT INTO chat_history (message_id, conversation_id, sender, message, results) VALUES (?, ?, 'ai', ?, ?)`;
        const resultsJson = aiResultsPayload ? JSON.stringify(aiResultsPayload) : null;

        logger.debug(SERVICE_NAME, `Saving user message: ${userMessageId}`);
        await dbRun(db, userSql, [userMessageId, conversationId, userMessage]);
        logger.debug(SERVICE_NAME, `Saving AI message: ${aiMessageId}`);
        await dbRun(db, aiSql, [aiMessageId, conversationId, aiMessage, resultsJson]);
        logger.info(SERVICE_NAME, 'Successfully saved user and AI messages.');

        // 2. Title Generation Logic
        logger.debug(SERVICE_NAME, `Checking if title needs generation for convo ${conversationId}`);
        const countSql = `SELECT COUNT(*) as count FROM chat_history WHERE conversation_id = ?`;
        const countResult = await dbGet(db, countSql, [conversationId]);

        if (countResult && countResult.count === 2) {
            logger.info(SERVICE_NAME, 'First exchange detected. Checking title...');
            const titleSql = `SELECT title FROM conversations WHERE conversation_id = ? AND user_id = ?`;
            const convoData = await dbGet(db, titleSql, [conversationId, userId]);

            if (convoData && convoData.title === "New Chat") {
                logger.info(SERVICE_NAME, 'Title is default. Generating new title...');
                try {
                    const newTitle = await generateTitle(userMessage, aiMessage);
                    await updateConversationTitle(conversationId, newTitle); // From database.js
                    logger.info(SERVICE_NAME, `Successfully updated title for convo ${conversationId}.`);
                } catch (titleGenError) {
                    logger.error(SERVICE_NAME, 'Failed to generate or save title', titleGenError);
                    // Do not block the main process
                }
            } else {
                logger.debug(SERVICE_NAME, 'Title already set or conversation not found.');
            }
        } else {
            logger.debug(SERVICE_NAME, `Not first exchange (count: ${countResult?.count}). Skipping title gen.`);
        }
    } catch (dbError) {
        logger.error(SERVICE_NAME, "Failed during message saving or title generation", dbError);
    }
}

/**
 * Creates a new, empty conversation.
 */
async function createConversation(userId, roomId) {
    logger.info(SERVICE_NAME, `Creating new conversation for user ${userId} in room ${roomId}`);
    const db = getDb();
    const conversationId = uuidv4();
    const title = "New Chat";

    const sql = `INSERT INTO conversations (conversation_id, user_id, title, room_id) VALUES (?, ?, ?, ?)`;
    const params = [conversationId, userId, title, roomId];

    try {
        await dbRun(db, sql, params);
        logger.info(SERVICE_NAME, `Conversation ${conversationId} created.`);
        return {
            conversation_id: conversationId,
            user_id: userId,
            room_id: parseInt(roomId, 10),
            title: title,
            created_at: new Date().toISOString()
        };
    } catch (err) {
        logger.error(SERVICE_NAME, 'Failed to insert new conversation', err);
        throw new Error('Failed to create conversation in database.');
    }
}

/**
 * Fetches all conversations for a user in a specific room.
 */
async function getConversations(userId, roomId) {
    logger.info(SERVICE_NAME, `Fetching conversations for user ${userId} in room ${roomId}`);
    const db = getDb();
    const sql = `SELECT conversation_id, title, created_at, room_id 
                 FROM conversations 
                 WHERE user_id = ? AND room_id = ? 
                 ORDER BY created_at DESC`;
    const params = [userId, roomId];

    try {
        const rows = await dbAll(db, sql, params);
        logger.info(SERVICE_NAME, `Found ${rows.length} conversations.`);
        return rows || [];
    } catch (err) {
        logger.error(SERVICE_NAME, 'Failed to fetch conversations', err);
        throw new Error('Failed to fetch conversations from database.');
    }
}

/**
 * Fetches and parses the history for a single conversation.
 */
async function getConversationHistory(userId, conversationId) {
    logger.info(SERVICE_NAME, `Fetching history for convo ${conversationId} (user ${userId})`);
    const db = getDb();

    try {
        // 1. Verify ownership
        const verifySql = `SELECT user_id FROM conversations WHERE conversation_id = ? AND user_id = ?`;
        const row = await dbGet(db, verifySql, [conversationId, userId]);

        if (!row) {
            logger.warn(SERVICE_NAME, `User ${userId} attempted to access unauthorized convo ${conversationId}.`);
            throw new Error('Access denied'); // Specific error for controller
        }

        // 2. Fetch history
        logger.debug(SERVICE_NAME, `Ownership verified for ${conversationId}. Fetching messages...`);
        const historySql = `SELECT message_id, sender, message, results, timestamp 
                            FROM chat_history 
                            WHERE conversation_id = ? 
                            ORDER BY timestamp ASC`;
        const messages = await dbAll(db, historySql, [conversationId]);

        // 3. Parse results
        const history = (messages || []).map(msg => {
            const messageData = {
                sender: msg.sender,
                text: msg.message
            };
            if (msg.sender === 'ai' && msg.results) {
                try {
                    messageData.results = JSON.parse(msg.results);
                } catch (parseError) {
                    logger.error(SERVICE_NAME, `Failed to parse results JSON for msg ${msg.message_id}`, parseError);
                    messageData.results = null; // Send null on parse failure
                }
            }
            return messageData;
        });

        logger.info(SERVICE_NAME, `Found ${history.length} messages for convo ${conversationId}.`);
        return history;

    } catch (err) {
        logger.error(SERVICE_NAME, `Error in getConversationHistory for ${conversationId}`, err);
        if (err.message === 'Access denied') {
            throw err;
        }
        throw new Error('Failed to fetch conversation history.');
    }
}

module.exports = {
    saveMessages,
    createConversation,
    getConversations,
    getConversationHistory,
};