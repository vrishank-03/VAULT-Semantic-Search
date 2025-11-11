// backend/services/logService.js

const { getDb } = require('../database');

/**
 * @desc      Logs a user entry into a chat room
 * @param {number} userId - The ID of the user entering
 * @param {number} roomId - The ID of the room being entered
 * @returns {Promise<{sessionLogId: number}>}
 */
const logRoomEntryLogic = (userId, roomId) => {
    return new Promise((resolve, reject) => {
        console.log(`[LOG_SERVICE] Logging entry for user ${userId} in room ${roomId}`);
        const db = getDb();
        const sql = `INSERT INTO room_session_logs (user_id, room_id, login_timestamp) VALUES (?, ?, ?)`;
        const params = [userId, roomId, new Date().toISOString()];
        
        console.log(`[LOG_SERVICE_DB] Executing: ${sql} with params: [${userId}, ${roomId}, ...]`);
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`[LOG_SERVICE_DB_ERROR] Failed to log room entry:`, err.message);
                reject(new Error("Failed to create log entry."));
            } else {
                const logId = this.lastID;
                console.log(`[LOG_SERVICE_SUCCESS] Logged session entry with ID: ${logId}`);
                resolve({ sessionLogId: logId });
            }
        });
    });
};

module.exports = {
    logRoomEntryLogic
};