// frontend/src/pages/ChatRoomPage/hooks/useRoomAccess.js

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinRoom, logRoomEntry } from '../../../services/api';

/**
 * Hook to manage checking and validating a user's access to a room.
 * @param {string} roomId - The ID of the room from the URL.
 * @returns {object} { accessStatus, roomName, checkRoomAccess }
 */
export const useRoomAccess = (roomId) => {
    const [accessStatus, setAccessStatus] = useState('checking');
    const [roomName, setRoomName] = useState(`Room ${roomId}`);
    const navigate = useNavigate();

    const checkRoomAccess = useCallback(async () => {
        if (!roomId) {
            setAccessStatus('denied');
            return;
        }

        console.log(`[useRoomAccess] Checking access for room ID: ${roomId}...`);
        try {
            const response = await joinRoom(roomId);
            const status = response.data.status;
            console.log(`[useRoomAccess] API response: ${status}`);
            
            if (status === 'granted') {
                setAccessStatus('granted');
                logRoomEntry(roomId);
                const currentRoomName = response.data.roomName || `Room ${roomId}`;
                setRoomName(currentRoomName);
                return currentRoomName; // Return name for initialization
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