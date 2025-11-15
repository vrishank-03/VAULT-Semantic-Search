// backend/controllers/chatController.js

const RAGPipelineService = require('../services/RAGPipelineService');
const ChatHistoryService = require('../services/ChatHistoryService');
const logger = require('../utils/logger');
const { getDb } = require('../database');

const SERVICE_NAME = 'chatController';

/**
 * [NEW] Handles the ASYNCHRONOUS streaming chat query.
 * This function is non-blocking. It validates the request,
 * triggers the RAG pipeline, and immediately returns a 202 response.
 * The RAG pipeline will send the answer back over Socket.io.
 */
exports.handleChatQuery = (req, res) => {
    const { roomId, conversationId } = req.params;
    const { query, socketId, modelName, isDeepThink } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const reqSocketServer = req.io; // The Socket.io server instance

    logger.info(SERVICE_NAME, `[START] POST /${roomId}/${conversationId} for user ${userId}`);
    logger.debug(SERVICE_NAME, `Body: { query: "${query.substring(0, 20)}...", socketId: ${socketId}, model: ${modelName}, deepThink: ${isDeepThink} }`);

    // --- 1. Validation ---
    if (!query) {
        logger.warn(SERVICE_NAME, 'Validation failed: No query provided.');
        return res.status(400).json({ message: 'Query is required.' });
    }
    if (!socketId) {
        logger.warn(SERVICE_NAME, 'Validation failed: No socketId provided.');
        return res.status(400).json({ message: 'socketId is required for streaming response.' });
    }
    if (!reqSocketServer) {
        logger.error(SERVICE_NAME, 'Validation failed: req.io (Socket.io server) is not attached.');
        return res.status(500).json({ message: 'Server configuration error.' });
    }
    
    // --- 2. Find the specific user's socket ---
    const socket = reqSocketServer.sockets.sockets.get(socketId);
    if (!socket) {
        logger.error(SERVICE_NAME, `Validation failed: Socket ID ${socketId} not found or disconnected.`);
        return res.status(404).json({ message: 'Client socket not found. Please reconnect.' });
    }

    // --- 3. Define the unique event name for this response ---
    // The frontend will listen to *this specific event*
    const responseEventName = `chat_response_${conversationId}`;

    // --- 4. Trigger the RAG pipeline (FIRE-AND-FORGET) ---
    // We do NOT await this. This is the key to non-blocking.
    // The pipeline will run in the background.
    logger.info(SERVICE_NAME, `Triggering async RAGPipelineService. User socket: ${socket.id}, Event: ${responseEventName}`);
    RAGPipelineService.handleUserQuery({
        // Query Details
        query,
        modelName,
        isDeepThink,
        // Context
        userId,
        userRole,
        roomId,
        conversationId,
        // Streaming
        socket,
        responseEventName
    }).catch(pipelineError => {
        // This catch is for *unhandled* exceptions during pipeline boot-up
        logger.error(SERVICE_NAME, `[FATAL] RAG Pipeline boot-up failed for convo ${conversationId}:`, pipelineError);
        socket.emit(responseEventName, {
            type: 'error',
            data: { message: 'A fatal error occurred while starting the pipeline.' }
        });
    });

    // --- 5. Immediately send the HTTP 202 Accepted response ---
    // This tells the frontend "We got your request, now listen on this socket event."
    logger.info(SERVICE_NAME, `[END] Sending 202 Accepted. Listening event: ${responseEventName}`);
    res.status(202).json({
        message: 'Query received. Processing... Listen for streaming response.',
        eventName: responseEventName
    });
};

/**
 * [NEW] Creates a new, empty conversation.
 */
exports.createConversation = async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    logger.info(SERVICE_NAME, `POST /${roomId}/new for user ${userId}`);
    
    try {
        const newConversation = await ChatHistoryService.createConversation(userId, roomId);
        logger.info(SERVICE_NAME, `Conversation ${newConversation.conversation_id} created.`);
        res.status(201).json(newConversation);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to create conversation in room ${roomId}`, error);
        res.status(500).json({ message: 'Error creating conversation.' });
    }
};

/**
 * [NEW] Gets all conversations for the user in a specific room.
 */
exports.getConversations = async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    logger.info(SERVICE_NAME, `GET /${roomId} for user ${userId}`);

    try {
        const conversations = await ChatHistoryService.getConversations(userId, roomId);
        res.status(200).json(conversations);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to get conversations for user ${userId} in room ${roomId}`, error);
        res.status(500).json({ message: 'Error fetching conversations.' });
    }
};

/**
 * [NEW] Gets the full message history for one conversation.
 */
exports.getConversationHistory = async (req, res) => {
    const { roomId, conversationId } = req.params;
    const userId = req.user.id;
    logger.info(SERVICE_NAME, `GET /${roomId}/${conversationId} for user ${userId}`);

    try {
        // The service layer handles auth (checking if this user owns this convo)
        const history = await ChatHistoryService.getConversationHistory(userId, conversationId);
        res.status(200).json(history);
    } catch (error) {
        if (error.message === 'Access denied') {
            logger.warn(SERVICE_NAME, `Access denied for user ${userId} on convo ${conversationId}`);
            return res.status(403).json({ message: 'Access denied.' });
        }
        logger.error(SERVICE_NAME, `Failed to get history for convo ${conversationId}`, error);
        res.status(500).json({ message: 'Error fetching history.' });
    }
};