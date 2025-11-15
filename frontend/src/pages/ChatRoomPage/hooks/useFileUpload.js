// frontend/src/pages/ChatRoomPage/hooks/useFileUpload.js

import { useState, useRef, useEffect } from 'react';
import { uploadDocument } from '../../../services/api';
import { useSocket } from '../../../context/SocketContext'; // [WORKER_REFACTOR] Import useSocket

/**
 * Hook to manage file uploads.
 * @param {string} roomId - The ID of the current room.
 * @param {function} setToast - The state setter for toasts.
 * @param {function} fetchDocuments - Callback to refresh the document list.
 * @returns {object} All state and handlers for file upload.
 */
export const useFileUpload = (roomId, setToast, fetchDocuments) => {
    const [isUploading, setIsUploading] = useState(false);
    const uploadAbortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    
    // [WORKER_REFACTOR] Get socket info
    const { socket, socketId, isConnected } = useSocket();
    
    // [WORKER_REFACTOR] Use a Ref to track the count of files being processed
    // This correctly handles multiple file uploads.
    const processingFileCount = useRef(0);

    // [WORKER_REFACTOR] Add a listener for worker events
    useEffect(() => {
        if (socket && isConnected) {
            
            const handleDocumentStatus = (event) => {
                console.log('[useFileUpload] [SOCKET] Received document_status event:', event);
                
                switch (event.type) {
                    case 'status':
                        // Show info toast with progress
                        setToast({ message: event.message, type: 'info', duration: 3000 });
                        break;
                    
                    case 'complete':
                        setToast({ message: event.message, type: 'success' });
                        fetchDocuments(); // Refresh the document list
                        
                        // Decrement the processing count
                        processingFileCount.current = Math.max(0, processingFileCount.current - 1);
                        if (processingFileCount.current === 0) {
                            setIsUploading(false); // Turn off animation
                        }
                        break;
                    
                    case 'error':
                        setToast({ message: event.message, type: 'error' });
                        
                        // Decrement the processing count
                        processingFileCount.current = Math.max(0, processingFileCount.current - 1);
                        if (processingFileCount.current === 0) {
                            setIsUploading(false); // Turn off animation
                        }
                        break;
                    
                    default:
                        console.warn('[useFileUpload] Unknown document_status type:', event.type);
                }
            };

            socket.on('document_status', handleDocumentStatus);

            return () => {
                socket.off('document_status', handleDocumentStatus);
            };
        }
    }, [socket, isConnected, setToast, fetchDocuments]);


    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // [WORKER_REFACTOR] Check for socket connection first
        if (!socketId) {
            setToast({ message: 'Error: Not connected to server for upload. Please wait and try again.', type: 'error' });
            return;
        }

        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;
        setIsUploading(true); // Turn on the processing animation
        setToast(null);

        try {
            // [WORKER_REFACTOR] Add the files to our tracking ref
            processingFileCount.current += files.length;
            
            // [WORKER_REFACTOR] Pass the socketId to the API
            const result = await uploadDocument(files, roomId, socketId, controller.signal);
            
            // [WORKER_REFACTOR] Handle the 202 Accepted response
            // The old code (result.data.documentIds) is now IRRELEVANT
            setToast({ message: result.data.message, type: 'info' });

        } catch (error) {
            // This catch now handles HTTP errors (e.g., 400, 403, 500)
            // or the abort error.
            
            // If we abort, we must manually reset the processing count
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                 setToast({ message: "Upload stopped.", type: 'warning' });
                 processingFileCount.current = 0; // Reset count
                 setIsUploading(false); // Stop animation
            
            // Handle other HTTP errors
            } else if (error.response?.status === 409) {
                setToast({ message: error.response.data.message, type: 'error' });
                processingFileCount.current = Math.max(0, processingFileCount.current - files.length);
            } else if (error.response?.status === 403) {
                 setToast({ message: "You do not have permission to upload documents.", type: 'error' });
                 processingFileCount.current = Math.max(0, processingFileCount.current - files.length);
            } else {
                 setToast({ message: error.response?.data?.message || `Upload failed. Please try again.`, type: 'error' });
                 processingFileCount.current = Math.max(0, processingFileCount.current - files.length);
            }
            
            // If an error occurred, and no jobs are left, stop the animation
            if (processingFileCount.current === 0) {
                setIsUploading(false);
            }

        } finally {
            // [WORKER_REFACTOR] We NO LONGER set isUploading(false) here.
            // We let the socket events control the loading state.
            // We only clear the file input.
            
            uploadAbortControllerRef.current = null;
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleStopUpload = () => {
        if (uploadAbortControllerRef.current) {
            // This will trigger the 'CanceledError' in the try/catch block
            uploadAbortControllerRef.current.abort();
        }
    };

    return {
        // [WORKER_REFACTOR] We now just return 'isUploading'
        // This will be true from the start of the HTTP request
        // until the last 'complete' or 'error' event is received.
        isUploading,
        fileInputRef,
        handleFileUpload,
        handleStopUpload
    };
};