const RAGPipelineService = require('../services/RAGPipelineService');
const ChatHistoryService = require('../services/ChatHistoryService');
const logger = require('../utils/logger');

const SERVICE_NAME = 'chatController';

/**
 * [MODIFIED] Handles the ASYNCHRONOUS streaming chat query.
 * Extracts the required chatMode parameter.
 */
exports.handleChatQuery = (req, res) => {
    const { roomId, conversationId } = req.params;
    const { query, socketId, chatMode } = req.body; 
    const userId = req.user.id;
    const userRole = req.user.role;
    const reqSocketServer = req.io; // The Socket.io server instance
    
    // Validate chatMode to ensure it's one of our defined tiers
    const validModes = ['STANDARD', 'DEEP_THINK', 'DEEP_RESEARCH'];
    const finalChatMode = chatMode && validModes.includes(chatMode) ? chatMode : 'STANDARD';

    logger.info(SERVICE_NAME, `[START] POST /${roomId}/${conversationId} for user ${userId}`);
    logger.debug(SERVICE_NAME, `Body: { query: "${query ? query.substring(0, 20) : 'NULL'}...", socketId: ${socketId}, mode: ${finalChatMode} }`);

    // --- 1. Validation ---
    if (!query || !socketId || !reqSocketServer) {
        logger.warn(SERVICE_NAME, 'Validation failed: Missing query, socketId, or socket server.');
        return res.status(400).json({ message: 'Missing required query or streaming context.' });
    }
    
    // --- 2. Find the specific user's socket ---
    const socket = reqSocketServer.sockets.sockets.get(socketId);
    if (!socket) {
        logger.error(SERVICE_NAME, `Validation failed: Socket ID ${socketId} not found or disconnected.`);
        return res.status(404).json({ message: 'Client socket not found. Please reconnect.' });
    }

    // --- 3. Define the unique event name for this response ---
    const responseEventName = `chat_response_${conversationId}`;

    // --- 4. Trigger the RAG pipeline (FIRE-AND-FORGET) ---
    logger.info(SERVICE_NAME, `Triggering async RAGPipelineService. Mode: ${finalChatMode}`);
    
    // [ASYNC EXECUTION] We do NOT await this. 
    // The pipeline runs in the background and emits events via Socket.io
    RAGPipelineService.handleUserQuery({
        query,
        chatMode: finalChatMode,
        userId,
        userRole,
        roomId,
        conversationId,
        socket,
        responseEventName
    }).catch(pipelineError => {
        logger.error(SERVICE_NAME, `[FATAL] RAG Pipeline boot-up failed for convo ${conversationId}:`, pipelineError);
        socket.emit(responseEventName, {
            type: 'error',
            data: { message: 'A fatal error occurred while starting the pipeline.' }
        });
    });

    // --- 5. Immediately send the HTTP 202 Accepted response ---
    logger.info(SERVICE_NAME, `[END] Sending 202 Accepted. Event: ${responseEventName}`);
    res.status(202).json({
        message: 'Query received. Processing... Listen for streaming response.',
        eventName: responseEventName
    });
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
        logger.info(SERVICE_NAME, `Conversation ${newConversation.conversation_id} created.`);
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
 * [EXISTING] Gets the full message history for one conversation.
 */
exports.getConversationHistory = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    logger.info(SERVICE_NAME, `GET /history/${conversationId} for user ${userId}`);
    
    try {
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

/**
 * [NEW] Deletes a conversation and all history.
 */
exports.deleteConversation = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    logger.info(SERVICE_NAME, `DELETE /${conversationId} for user ${userId}`);

    try {
        const result = await ChatHistoryService.deleteConversation(userId, conversationId);
        if (!result.success) {
            return res.status(404).json({ message: result.message });
        }
        logger.info(SERVICE_NAME, `Successfully deleted convo ${conversationId}`);
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
    logger.info(SERVICE_NAME, `GET /search for user ${userId} with term: "${searchTerm}"`);

    if (!searchTerm || searchTerm.length < 3) {
        logger.warn(SERVICE_NAME, 'Search term too short or missing.');
        return res.status(400).json({ message: 'Search term must be at least 3 characters.' });
    }
    
    try {
        const results = await ChatHistoryService.searchChatHistory(userId, searchTerm);
        logger.info(SERVICE_NAME, `Found ${results.length} grouped search results.`);
        res.status(200).json(results);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to run search for user ${userId}`, error);
        res.status(500).json({ message: 'Error performing search.' });
    }
};