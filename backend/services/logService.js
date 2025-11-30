// backend/services/logService.js - POSTGRES FIXED
const { query } = require('../database');

/**
 * @desc      Logs a user entry into a chat room
 * @param {number} userId - The ID of the user entering
 * @param {number} roomId - The ID of the room being entered
 * @returns {Promise<{sessionLogId: number}>}
 */
const logRoomEntryLogic = async (userId, roomId) => {
    console.log(`[LOG_SERVICE] Logging entry for user ${userId} in room ${roomId}`);
    
    const sql = `
        INSERT INTO room_session_logs (user_id, room_id, login_timestamp) 
        VALUES ($1, $2, $3) 
        RETURNING id
    `;
    const params = [userId, roomId, new Date().toISOString()];
    
    try {
        const result = await query(sql, params);
        const logId = result.rows[0].id;
        console.log(`[LOG_SERVICE_SUCCESS] Logged session entry with ID: ${logId}`);
        return { sessionLogId: logId };
    } catch (err) {
        console.error(`[LOG_SERVICE_DB_ERROR] Failed to log room entry:`, err.message);
        // We log the error but don't crash the request flow for a log failure
        return { sessionLogId: null };
    }
};

module.exports = {
    logRoomEntryLogic
};