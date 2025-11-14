// backend/chatController.js
// Refactored

// --- [NOTE] ---
// We need to add the /message route handler that calls performRAG.
// I will add it here, assuming it was missing from the original file.
// --- [END NOTE] ---

const ChatHistoryService = require('../services/ChatHistoryService');
const RAGPipelineService = require('../services/RAGPipelineService');
const logger = require('../utils/logger');

const SERVICE_NAME = 'ChatController';

/**
 * Handles an incoming chat message, runs the RAG pipeline, and returns the answer.
 * @route POST /api/chat/message
 */
const handleChatMessage = async (req, res) => {
    if (!req.user || !req.user.id) {
        logger.warn(SERVICE_NAME, 'Chat message request without authenticated user.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { query, history, conversationId, roomId } = req.body;
    const userId = req.user.id;

    if (!query || !conversationId || !roomId) {
        logger.warn(SERVICE_NAME, 'Chat message request missing required body params.', req.body);
        return res.status(400).json({ error: 'Missing required fields: query, conversationId, and roomId.' });
    }

    logger.info(SERVICE_NAME, `Processing chat message for convo ${conversationId} in room ${roomId}`);

    try {
        const ragPayload = await RAGPipelineService.performRAG(
            userId,
            query,
            history || [],
            conversationId,
            roomId
        );
        
        logger.info(SERVICE_NAME, `RAG pipeline successful for convo ${conversationId}.`);
        res.status(200).json(ragPayload);

    } catch (error) {
        logger.error(SERVICE_NAME, `RAG pipeline failed for convo ${conversationId}`, error);
        res.status(500).json({ error: 'Failed to process your message.' });
    }
};

/**
 * Creates a new, empty conversation for a user in a specific room.
 * @route POST /api/chat/new/:roomId
 */
const createConversation = async (req, res) => {
    if (!req.user || !req.user.id) {
        logger.warn(SERVICE_NAME, 'Create conversation request without authenticated user.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const { roomId } = req.params;
    if (!roomId) {
        logger.warn(SERVICE_NAME, 'Create conversation request missing roomId.');
        return res.status(400).json({ error: 'Room ID is required' });
    }

    logger.info(SERVICE_NAME, `User ${req.user.id} creating new conversation in room ${roomId}`);
    
    try {
        const conversation = await ChatHistoryService.createConversation(req.user.id, roomId);
        logger.info(SERVICE_NAME, `Successfully created conversation ${conversation.conversation_id}`);
        res.status(201).json(conversation);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to create conversation for room ${roomId}`, error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
};

/**
 * Fetches all conversations for the logged-in user for a specific room.
 * @route GET /api/chat/conversations/:roomId
 */
const getConversations = async (req, res) => {
    if (!req.user || !req.user.id) {
        logger.warn(SERVICE_NAME, 'Get conversations request without authenticated user.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const { roomId } = req.params;
    if (!roomId) {
        logger.warn(SERVICE_NAME, 'Get conversations request missing roomId.');
        return res.status(400).json({ error: 'Room ID is required' });
    }

    logger.info(SERVICE_NAME, `User ${req.user.id} fetching conversations for room ${roomId}`);

    try {
        const conversations = await ChatHistoryService.getConversations(req.user.id, roomId);
        logger.info(SERVICE_NAME, `Found ${conversations.length} conversations for user ${req.user.id}`);
        res.status(200).json(conversations);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to fetch conversations for room ${roomId}`, error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

/**
 * Fetches the message history for a specific conversation, ensuring user owns it.
 * @route GET /api/chat/history/:conversationId
 */
const getConversationHistory = async (req, res) => {
    if (!req.user || !req.user.id) {
        logger.warn(SERVICE_NAME, 'Get history request without authenticated user.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const { conversationId } = req.params;
    if (!conversationId) {
        logger.warn(SERVICE_NAME, 'Get history request missing conversationId.');
        return res.status(400).json({ error: 'Conversation ID is required' });
    }

    logger.info(SERVICE_NAME, `User ${req.user.id} fetching history for convo ${conversationId}`);

    try {
        const history = await ChatHistoryService.getConversationHistory(req.user.id, conversationId);
        logger.info(SERVICE_NAME, `Successfully fetched ${history.length} messages for convo ${conversationId}`);
        res.status(200).json(history);
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to fetch history for convo ${conversationId}`, error);
        if (error.message === 'Access denied') {
            return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
};

module.exports = {
    handleChatMessage, // <-- Make sure this is added to chatRoutes.js
    createConversation,
    getConversations,
    getConversationHistory
};