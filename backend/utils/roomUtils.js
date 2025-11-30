// backend/utils/roomUtils.js - POSTGRES FIXED
const { query } = require('../database');

/**
 * @desc      Generates a 6-digit room code that is guaranteed to be unique
 * @returns {Promise<string>} A unique 6-digit room code
 */
const generateUniqueRoomCode = async () => {
    let isUnique = false;
    let code;

    console.log(`[JIT_CODE_GEN] Starting unique code generation...`);

    while (!isUnique) {
        // Generate random 6-digit number
        code = Math.floor(100000 + Math.random() * 900000).toString();
        
        try {
            // Check DB for existence
            const res = await query('SELECT id FROM chat_rooms WHERE room_code = $1', [code]);
            
            if (res.rowCount === 0) {
                console.log(`[JIT_CODE_GEN_SUCCESS] Unique code generated: ${code}`);
                isUnique = true;
            } else {
                console.log(`[JIT_CODE_GEN_COLLISION] Room code ${code} exists. Retrying...`);
            }
        } catch (err) {
            console.error('[JIT_CODE_GEN_ERROR] DB Error checking code:', err.message);
            throw new Error('Database error generating room code.');
        }
    }

    return code;
};

module.exports = {
    generateUniqueRoomCode
};