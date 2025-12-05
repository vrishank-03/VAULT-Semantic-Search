// backend/controllers/chatController.js - DIRECT LINK TO SEARCH SERVICE
// --------------------------------------------------------
// [REFACTOR] Bypasses RAGPipelineService to directly use the fixed searchService.
// [COMPATIBILITY] Simulates Socket.io streaming events so Frontend accepts the response.
// --------------------------------------------------------

const { performRAG } = require('../searchService'); // Use the fixed service
const ChatHistoryService = require('../services/ChatHistoryService');
const logger = require('../utils/logger');

const SERVICE_NAME = 'chatController';

/**
 * [MODIFIED] Handles the chat query by calling searchService directly.
 * Simulates streaming events to maintain frontend compatibility.
 */
exports.handleChatQuery = async (req, res) => {
    const { roomId, conversationId } = req.params;
    const { query, socketId, chatMode } = req.body;
    const userId = req.user.id;
    const reqSocketServer = req.io;

    // Default to 'STANDARD' if mode is invalid
    const validModes = ['STANDARD', 'DEEP_THINK', 'DEEP_RESEARCH'];
    const finalChatMode = chatMode && validModes.includes(chatMode) ? chatMode : 'STANDARD';

    logger.info(SERVICE_NAME, `[START] POST /${roomId}/${conversationId} for user ${userId}`);

    // --- 1. Validation ---
    if (!query || !socketId || !reqSocketServer) {
        return res.status(400).json({ message: 'Missing required query or streaming context.' });
    }

    const socket = reqSocketServer.sockets.sockets.get(socketId);
    if (!socket) {
        return res.status(404).json({ message: 'Client socket not found. Please reconnect.' });
    }

    const responseEventName = `chat_response_${conversationId}`;

    // --- 2. Send Immediate HTTP 202 (Accepted) ---
    // This tells the frontend "We got it, listen to the socket now"
    res.status(202).json({
        message: 'Query received. Processing...',
        eventName: responseEventName
    });

    // --- 3. Async Execution (The "Pipeline") ---
    // We run this in the background so the HTTP request completes fast
    (async () => {
        try {
            logger.info(SERVICE_NAME, `[ASYNC] Starting RAG for convo ${conversationId}...`);

            // Notify Frontend: "We are thinking..."
            socket.emit(responseEventName, { type: 'start' });
            socket.emit(responseEventName, { type: 'thinking', data: 'Searching documents...' });

            // A. Perform RAG (Retrieval + Generation)
            // This calls our new Node-side logic in searchService.js
            const result = await performRAG(userId, query, [], conversationId, roomId);

            // B. Simulate Streaming (Send the full answer as one chunk)
            // Since we aren't streaming token-by-token, we send the whole block.
            // The frontend should append this chunk to the UI.
            if (result.answer) {
                socket.emit(responseEventName, {
                    type: 'chunk',
                    data: result.answer
                });
            }

            // C. Finish
            logger.info(SERVICE_NAME, `[ASYNC] RAG Complete. Sending done signal.`);
            socket.emit(responseEventName, {
                type: 'done',
                data: { sources: result.sources || [] }
            });

        } catch (error) {
            logger.error(SERVICE_NAME, `[FATAL] RAG failed for convo ${conversationId}:`, error.message);
            socket.emit(responseEventName, {
                type: 'error',
                data: { message: 'An error occurred while processing your request.' }
            });
        }
    })();
};

/**
 * [EXISTING] Creates a new, empty conversation.
 */
exports.createConversation = async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    logger.info(SERVICE_NAME, `POST /${roomId}/new for user ${userId}`);

    try {
        const newConversation = await ChatHistoryService.createConversation(userId, roomId);
        res.status(201).json(newConversation);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to create conversation in room ${roomId}`, error);
        res.status(500).json({ message: 'Error creating conversation.' });
    }
};

/**
 * [EXISTING] Gets all conversations for the user in a specific room.
 */
exports.getConversations = async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;

    try {
        const conversations = await ChatHistoryService.getConversations(userId, roomId);
        res.status(200).json(conversations);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to get conversations`, error);
        res.status(500).json({ message: 'Error fetching conversations.' });
    }
};

/**
 * [EXISTING] Gets the full message history for one conversation.
 */
exports.getConversationHistory = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    try {
        const history = await ChatHistoryService.getConversationHistory(userId, conversationId);
        res.status(200).json(history);
    } catch (error) {
        if (error.message === 'Access denied') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        res.status(500).json({ message: 'Error fetching history.' });
    }
};

/**
 * [NEW] Deletes a conversation and all history.
 */
exports.deleteConversation = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    try {
        const result = await ChatHistoryService.deleteConversation(userId, conversationId);
        if (!result.success) {
            return res.status(404).json({ message: result.message });
        }
        res.status(204).send();
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to delete conversation ${conversationId}`, error);
        res.status(500).json({ message: 'Error deleting conversation.' });
    }
};

/**
 * [NEW] Searches conversation history across all rooms for a user.
 */
exports.searchChatHistory = async (req, res) => {
    const { q: searchTerm } = req.query;
    const userId = req.user.id;

    if (!searchTerm || searchTerm.length < 3) {
        return res.status(400).json({ message: 'Search term must be at least 3 characters.' });
    }

    try {
        const results = await ChatHistoryService.searchChatHistory(userId, searchTerm);
        res.status(200).json(results);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to run search for user ${userId}`, error);
        res.status(500).json({ message: 'Error performing search.' });
    }
};