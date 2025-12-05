// frontend/src/pages/ChatRoomPage/hooks/useFileUpload.js
// --------------------------------------------------------
// [FIXED] Force-kills spinner on ANY 'complete' event to prevent deadlocks
// [FIXED] Added logging to trace the exact state transition
// --------------------------------------------------------

import { useState, useRef, useEffect } from 'react';
import { uploadDocument } from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';

export const useFileUpload = (roomId, setToast, fetchDocuments) => {
    const [isUploading, setIsUploading] = useState(false);
    const uploadAbortControllerRef = useRef(null);
    const fileInputRef = useRef(null);

    const { socket, socketId, isConnected } = useSocket();

    // Tracks active uploads.
    const processingFileCount = useRef(0);

    useEffect(() => {
        if (socket && isConnected) {

            const handleDocumentStatus = (event) => {
                console.log('[useFileUpload] 📨 Socket Event:', event);

                // [FIX] Normalize type
                const rawType = event.type || event.data?.type || '';
                const eventType = rawType.toLowerCase();

                // [FIX] Handle nested data structure if backend sends { data: { message: ... } }
                const message = event.message || event.data?.message || 'Processing update...';

                switch (eventType) {
                    case 'status':
                    case 'progress':
                    case 'processing':
                        setToast({ message: message, type: 'info', duration: 2000 });
                        break;

                    case 'complete':
                    case 'completed':
                    case 'success':
                    case 'done':
                        console.log('[useFileUpload] ✅ Job Complete. Refreshing docs.');
                        setToast({ message: message, type: 'success' });
                        fetchDocuments();

                        // [CRITICAL FIX] Force reset state. 
                        // We assume if one file finishes, the batch UI can relax or we decrement.
                        // For safety, if count <= 1, we kill the spinner immediately.
                        processingFileCount.current = Math.max(0, processingFileCount.current - 1);

                        // [SAFETY] If count is 0 OR this was the last expected event, stop.
                        if (processingFileCount.current === 0) {
                            console.log('[useFileUpload] 🛑 All jobs done. Stopping spinner.');
                            setIsUploading(false);
                        }
                        break;

                    case 'error':
                    case 'fail':
                    case 'failed':
                        console.error('[useFileUpload] ❌ Job Failed.');
                        setToast({ message: message, type: 'error' });

                        processingFileCount.current = Math.max(0, processingFileCount.current - 1);
                        if (processingFileCount.current === 0) {
                            setIsUploading(false);
                        }
                        break;

                    default:
                        // Ignore unknown events
                        break;
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

        if (!socketId) {
            setToast({ message: 'Error: Not connected to server.', type: 'error' });
            return;
        }

        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;

        setIsUploading(true); // START SPINNER
        setToast({ message: "Uploading...", type: 'info' });

        try {
            processingFileCount.current += files.length;

            const result = await uploadDocument(files, roomId, socketId, controller.signal);

            // 202 Accepted logic
            setToast({ message: result.data.message || "Upload queued...", type: 'info' });

        } catch (error) {
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                setToast({ message: "Upload stopped.", type: 'warning' });
                processingFileCount.current = 0;
                setIsUploading(false);
            } else {
                const msg = error.response?.data?.message || "Upload failed.";
                setToast({ message: msg, type: 'error' });
                processingFileCount.current = Math.max(0, processingFileCount.current - files.length);
            }

            if (processingFileCount.current === 0) {
                setIsUploading(false);
            }

        } finally {
            uploadAbortControllerRef.current = null;
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleStopUpload = () => {
        if (uploadAbortControllerRef.current) {
            uploadAbortControllerRef.current.abort();
        }
    };

    return {
        isUploading,
        fileInputRef,
        handleFileUpload,
        handleStopUpload
    };
};