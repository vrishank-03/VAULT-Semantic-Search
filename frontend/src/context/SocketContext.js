// frontend/src/context/SocketContext.js
// --------------------------------------------------------
// [FIXED] Prevents disconnect/connect loops by checking stable user ID
// [FIXED] Added explicit transport config to fix handshake errors
// --------------------------------------------------------

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

// [CONFIG] Set your backend URL
const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [socketId, setSocketId] = useState(null);

    // [FIX] Ref to track active connection and prevent duplicates
    const socketRef = useRef(null);

    // [FIX] Use a stable primitive (email/id) for dependencies, NOT the user object
    const userId = user?.email || user?.id;

    useEffect(() => {
        // If not authenticated, ensure socket is closed
        if (!userId) {
            if (socketRef.current) {
                console.log('[SocketContext] No user. Disconnecting socket.');
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
                setSocketId(null);
            }
            return;
        }

        // If socket exists and is connected, do nothing (Prevent Re-render Reconnects)
        if (socketRef.current && socketRef.current.connected) {
            return;
        }

        console.log(`[SocketContext] 🟢 Authenticated as ${userId}. Connecting to ${BACKEND_URL}`);

        // [FIX] Explicit transports and reconnection config
        const newSocket = io(BACKEND_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'], // Try WebSocket first
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            forceNew: true // Ensure a fresh connection handle
        });

        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            const id = newSocket.id;
            console.log(`[SocketContext] ✅ Socket Connected. ID: ${id}`);
            setIsConnected(true);
            setSocketId(id);
            setSocket(newSocket); // Update state for consumers
        });

        newSocket.on('disconnect', (reason) => {
            console.warn(`[SocketContext] ⚠️ Socket Disconnected. Reason: ${reason}`);
            setIsConnected(false);
            setSocketId(null);

            if (reason === 'io server disconnect') {
                // Server forced disconnect, manual reconnect needed
                newSocket.connect();
            }
        });

        newSocket.on('connect_error', (error) => {
            console.error('[SocketContext] ❌ Connection Error:', error.message);
            setIsConnected(false);
        });

        // Cleanup: Only run if userId changes (Logout)
        return () => {
            console.log(`[SocketContext] 🛑 Cleaning up connection for ${userId}`);
            newSocket.off('connect');
            newSocket.off('disconnect');
            newSocket.off('connect_error');
            newSocket.disconnect();

            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            setSocketId(null);
        };
    }, [userId]); // [CRITICAL] Only re-run if distinct user changes

    const value = {
        socket,
        isConnected,
        socketId
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};