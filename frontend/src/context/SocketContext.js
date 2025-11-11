// frontend/src/context/SocketContext.js

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import io from 'socket.io-client';

// The URL of our backend server
const SOCKET_URL = 'http://localhost:5000';

// Create the context
const SocketContext = createContext(null);

/**
 * Custom hook to access the socket instance.
 * @returns {import('socket.io-client').Socket} The socket instance.
 */
export const useSocket = () => {
    return useContext(SocketContext);
};

/**
 * Provider component that establishes and manages the socket.io connection.
 * @param {object} props
 * @param {React.ReactNode} props.children - The child components to render.
 */
export const SocketProvider = ({ children }) => {
    console.log('[SocketContext] SocketProvider rendered.');

    // useMemo ensures the socket instance is only created once.
    const socket = useMemo(() => {
        console.log('[SocketContext] Creating new socket.io-client instance...');
        return io(SOCKET_URL, {
            // We don't need withCredentials: true for socket.io if CORS is set up,
            // but it's good practice if we ever add auth to sockets.
            // withCredentials: true 
        });
    }, []);

    useEffect(() => {
        // Set up listeners for connection and disconnection
        const handleConnect = () => {
            console.log(`[SocketContext] [BLOCK_4] Socket connected successfully with ID: ${socket.id}`);
        };

        const handleDisconnect = (reason) => {
            console.warn(`[SocketContext] [BLOCK_4] Socket disconnected: ${reason}`);
        };

        const handleConnectError = (error) => {
            console.error(`[SocketContext] [BLOCK_4] Socket connection error:`, error.message);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        // Cleanup function to remove listeners when the provider unmounts
        return () => {
            console.log('[SocketContext] Cleaning up socket listeners...');
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
            // We don't disconnect here, as the memoized socket should persist
            // for the app's lifecycle. If you need to disconnect on logout,
            // you'd call socket.disconnect() from the AuthContext.
        };
    }, [socket]);

    // Provide the socket instance to all child components
    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};