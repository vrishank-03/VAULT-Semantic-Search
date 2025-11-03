const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid'); // We'll use UUID for unique IDs

/**
 * Creates a new, empty conversation for a user in a specific room.
 * @route POST /api/chat/new/:roomId
 */
const createConversation = (req, res) => {
    // 1. Get user from auth middleware
    if (!req.user || !req.user.id) {
        console.error('[CHAT_CTRL_ERROR] User not found in request. Check authMiddleware.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // --- [NEW] Get roomId from URL parameters ---
    const { roomId } = req.params;
    if (!roomId) {
        console.error('[CHAT_CTRL_ERROR] Room ID missing from request parameters.');
        return res.status(400).json({ error: 'Room ID is required' });
    }
    // --- [END NEW] ---

    const userId = req.user.id;
    const conversationId = uuidv4();
    const title = "New Chat"; // We can make this editable later

    console.log(`[CHAT_CTRL] Attempting to create new conversation for user ${userId} in room ${roomId}...`);

    try {
        const db = getDb();
        // --- [MODIFIED] Added room_id to SQL query ---
        const sql = `INSERT INTO conversations (conversation_id, user_id, title, room_id) VALUES (?, ?, ?, ?)`;
        const params = [conversationId, userId, title, roomId];

        console.log(`[CHAT_CTRL_DB] Executing SQL: ${sql} with params: [${conversationId}, ${userId}, ${title}, ${roomId}]`);

        db.run(sql, params, function(err) {
            if (err) {
                console.error('[CHAT_CTRL_DB_ERROR] Failed to insert new conversation:', err.message);
                return res.status(500).json({ error: 'Failed to create conversation' });
            }

            console.log(`[CHAT_CTRL_SUCCESS] Conversation created with ID: ${conversationId} for user: ${userId} in room: ${roomId}. Rows affected: ${this.changes}`);

            // Return the new conversation object to the frontend
            res.status(201).json({
                conversation_id: conversationId,
                user_id: userId,
                room_id: parseInt(roomId, 10), // --- [NEW] Send back room_id
                title: title,
                created_at: new Date().toISOString() // Send back the new object
            });
        });

    } catch (error) {
        console.error('[CHAT_CTRL_FATAL] Unhandled error in createConversation:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Fetches all conversations for the logged-in user for a specific room.
 * @route GET /api/chat/conversations/:roomId
 */
const getConversations = (req, res) => {
    // 1. Get user from auth middleware
    if (!req.user || !req.user.id) {
        console.error('[CHAT_CTRL_ERROR] User not found in request. Check authMiddleware.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // --- [NEW] Get roomId from URL parameters ---
    const { roomId } = req.params;
    if (!roomId) {
        console.error('[CHAT_CTRL_ERROR] Room ID missing from request parameters.');
        return res.status(400).json({ error: 'Room ID is required' });
    }
    // --- [END NEW] ---

    const userId = req.user.id;
    console.log(`[CHAT_CTRL] Attempting to fetch conversations for user ${userId} in room ${roomId}...`);

    try {
        const db = getDb();
        // --- [MODIFIED] Added room_id to WHERE clause ---
        const sql = `SELECT conversation_id, title, created_at, room_id 
                     FROM conversations 
                     WHERE user_id = ? AND room_id = ? 
                     ORDER BY created_at DESC`;
        
        const params = [userId, roomId];

        console.log(`[CHAT_CTRL_DB] Executing SQL: ${sql} with params: [${userId}, ${roomId}]`);

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('[CHAT_CTRL_DB_ERROR] Failed to fetch conversations:', err.message);
                return res.status(500).json({ error: 'Failed to fetch conversations' });
            }

            const conversations = rows || [];
            console.log(`[CHAT_CTRL_SUCCESS] Found ${conversations.length} conversations for user: ${userId} in room: ${roomId}.`);

            // Return the list of conversations
            res.status(200).json(conversations);
        });

    } catch (error) {
        console.error('[CHAT_CTRL_FATAL] Unhandled error in getConversations:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};


/**
 * Fetches the message history for a specific conversation, ensuring user owns it.
 */
const getConversationHistory = (req, res) => {
    if (!req.user || !req.user.id) {
        console.error('[CHAT_CTRL_ERROR] User not found in request. Check authMiddleware.');
        return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!req.params.conversationId) {
        console.error('[CHAT_CTRL_ERROR] Conversation ID missing from request parameters.');
        return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const userId = req.user.id;
    const { conversationId } = req.params;
    console.log(`[CHAT_CTRL] Attempting to fetch history for conversation ${conversationId} for user ${userId}...`);

    try {
        const db = getDb();

        // 1. Verify ownership
        const verifySql = `SELECT user_id FROM conversations WHERE conversation_id = ? AND user_id = ?`;
        console.log(`[CHAT_CTRL_DB] Executing Verify SQL: ${verifySql} with params: [${conversationId}, ${userId}]`);

        db.get(verifySql, [conversationId, userId], (verifyErr, row) => {
            if (verifyErr) {
                console.error('[CHAT_CTRL_DB_ERROR] Failed during ownership verification:', verifyErr.message);
                return res.status(500).json({ error: 'Database error during verification' });
            }
            if (!row) {
                console.warn(`[CHAT_CTRL_WARN] User ${userId} attempted to access unauthorized conversation ${conversationId}.`);
                return res.status(403).json({ error: 'Access denied to this conversation' });
            }

            console.log(`[CHAT_CTRL_DB] Ownership verified for conversation ${conversationId}. Fetching history...`);

            // --- MODIFICATION START ---
            // 2. Fetch history including the 'results' column
            const historySql = `SELECT message_id, sender, message, results, timestamp FROM chat_history WHERE conversation_id = ? ORDER BY timestamp ASC`;
            // --- MODIFICATION END ---
            console.log(`[CHAT_CTRL_DB] Executing History SQL: ${historySql} with params: [${conversationId}]`);

            db.all(historySql, [conversationId], (historyErr, messages) => {
                if (historyErr) {
                    console.error('[CHAT_CTRL_DB_ERROR] Failed to fetch chat history:', historyErr.message);
                    return res.status(500).json({ error: 'Failed to fetch chat history' });
                }

                // --- MODIFICATION START: Parse results ---
                const history = (messages || []).map(msg => {
                    const messageData = {
                        // Map database columns to the frontend's expected format
                        sender: msg.sender,
                        text: msg.message
                        // Add message_id or timestamp if needed later
                    };

                    // If it's an AI message and has results data, try parsing it
                    if (msg.sender === 'ai' && msg.results) {
                        try {
                            const parsedResults = JSON.parse(msg.results);
                            // Add the parsed results object to the message data
                            messageData.results = parsedResults;
                            // Optionally, ensure the structure matches what frontend expects
                            // e.g., if frontend expects `results.sources`, ensure it exists
                            if (!messageData.results.sources) {
                                console.warn(`[CHAT_CTRL_WARN] Parsed results for msg ${msg.message_id} missing 'sources' key.`);
                                // You might want to default it to an empty array
                                // messageData.results.sources = [];
                            }
                        } catch (parseError) {
                            console.error(`[CHAT_CTRL_ERROR] Failed to parse results JSON for message ${msg.message_id}:`, parseError.message);
                            // Decide how to handle parse errors:
                            // Option 1: Send null/undefined for results
                            messageData.results = null;
                            // Option 2: Send an error indicator?
                            // messageData.resultsError = 'Could not load sources';
                        }
                    }
                    return messageData;
                });
                // --- MODIFICATION END ---

                console.log(`[CHAT_CTRL_SUCCESS] Found ${history.length} messages (with results parsing attempted) for conversation: ${conversationId}.`);
                res.status(200).json(history);
            });
        });

    } catch (error) {
        console.error('[CHAT_CTRL_FATAL] Unhandled error in getConversationHistory:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};


module.exports = {
    createConversation,
    getConversations,
    getConversationHistory
};