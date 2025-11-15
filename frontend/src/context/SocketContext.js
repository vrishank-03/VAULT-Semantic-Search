// frontend/src/context/SocketContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
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

    // [FIX] This useEffect now *only* depends on 'user'
    // This stops the infinite re-render loop.
    useEffect(() => {
        // Only connect if the user is logged in
        if (user) {
            console.log(`[SocketContext] User authenticated. Connecting to Socket.io at ${BACKEND_URL}`);

            const newSocket = io(BACKEND_URL, {
                withCredentials: true,
            });

            newSocket.on('connect', () => {
                const id = newSocket.id;
                console.log(`[SocketContext] Socket connected. ID: ${id}`);
                setIsConnected(true);
                setSocketId(id);
            });

            newSocket.on('disconnect', (reason) => {
                console.warn(`[SocketContext] Socket disconnected. Reason: ${reason}`);
                setIsConnected(false);
                setSocketId(null);
            });

            newSocket.on('connect_error', (error) => {
                console.error('[SocketContext] Socket connection error:', error.message);
                setIsConnected(false);
            });

            setSocket(newSocket);

            // Cleanup function will ONLY run when 'user' changes (i.e., logs out)
            return () => {
                console.log('[SocketContext] User logged out or component unmounted. Disconnecting socket.');
                newSocket.disconnect();
                setSocket(null);
                setIsConnected(false);
                setSocketId(null);
            };
        }
    // [FIX] The dependency array ONLY contains 'user'.
    }, [user]);

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