// backend/utils/roomUtils.js

const { getDb } = require('../database');

/**
 * @desc      Generates a 6-digit room code that is guaranteed to be unique
 * @param {sqlite3.Database} db - The database instance
 * @returns {Promise<string>} A unique 6-digit room code
 */
const generateUniqueRoomCode = (db) => {
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(`[JIT_CODE_GEN] Attempting to generate code: ${code}`);
            db.get('SELECT id FROM chat_rooms WHERE room_code = ?', [code], (err, row) => {
                if (err) {
                    console.error('[JIT_CODE_GEN_ERROR] DB error checking code uniqueness:', err.message);
                    return reject(new Error('Database error generating room code.'));
                }
                if (row) {
                    console.log(`[JIT_CODE_GEN_COLLISION] Room code ${code} already exists. Retrying...`);
                    attempt(); 
                } else {
                    console.log(`[JIT_CODE_GEN_SUCCESS] Unique code generated: ${code}`);
                    resolve(code);
                }
            });
        };
        attempt();
    });
};

module.exports = {
    generateUniqueRoomCode
};