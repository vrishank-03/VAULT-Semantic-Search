// frontend/src/pages/ChatRoomPage/hooks/useRoomAccess.js
// --------------------------------------------------------
// [FIXED] Deep property inspection to find "test room" inside nested 'room' object
// [FIXED] Console logging for easier debugging of backend response structure
// --------------------------------------------------------

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinRoom, logRoomEntry } from '../../../services/api';

export const useRoomAccess = (roomId) => {
    const [accessStatus, setAccessStatus] = useState('checking');
    const [roomName, setRoomName] = useState(null);
    const navigate = useNavigate();

    const checkRoomAccess = useCallback(async () => {
        if (!roomId) {
            setAccessStatus('denied');
            return;
        }

        try {
            const response = await joinRoom(roomId);
            const data = response.data;
            const status = data.status;

            // [DEBUG] Log the exact structure so we can be 100% sure
            console.log('[useRoomAccess] Join Room Response:', data);

            if (status === 'granted') {
                setAccessStatus('granted');
                logRoomEntry(roomId);

                // [FIX] Deep check for the name in common backend patterns
                // Priority: 
                // 1. data.room.name (Nested object pattern)
                // 2. data.room.roomName
                // 3. data.roomName (Flat pattern)
                // 4. data.name
                const possibleName =
                    data.room?.name ||
                    data.room?.roomName ||
                    data.roomName ||
                    data.name ||
                    data.room_name;

                const finalName = possibleName || `Room ${roomId}`;

                setRoomName(finalName);
                return finalName;
            } else {
                setAccessStatus(status || 'denied');
            }
        } catch (error) {
            console.error("[useRoomAccess] Failed to check room access:", error);
            const status = error.response?.data?.status;
            if (status) {
                setAccessStatus(status);
            } else {
                navigate('/dashboard');
            }
        }
    }, [roomId, navigate]);

    return { accessStatus, roomName, checkRoomAccess, setRoomName };
};