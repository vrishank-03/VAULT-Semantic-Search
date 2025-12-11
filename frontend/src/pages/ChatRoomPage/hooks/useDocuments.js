// frontend/src/pages/ChatRoomPage/hooks/useDocuments.js
// --------------------------------------------------------
// [FIXED] Source Lookup: Finds ID by filename if missing (Fixes citation crash)
// [FIXED] Stability: Added strict null checks before API calls
// --------------------------------------------------------

import { useState, useCallback } from 'react';
import { getDocuments, getDocument } from '../../../services/api';

/**
 * Hook to manage fetching and displaying documents and the PDF viewer.
 * @param {string} roomId - The ID of the current room.
 * @param {boolean} isAccessGranted - Whether the user has access.
 * @param {function} setToast - The state setter for toasts.
 * @returns {object} All state and handlers for documents.
 */
export const useDocuments = (roomId, isAccessGranted, setToast) => {
    const [documents, setDocuments] = useState([]);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [currentHighlight, setCurrentHighlight] = useState(null);
    const [showDocuments, setShowDocuments] = useState(false);

    // --- FETCH LIST ---
    const fetchDocuments = useCallback(async () => {
        if (!roomId || !isAccessGranted) return;
        // console.log(`[useDocuments] Fetching documents for room ${roomId}...`);
        try {
            const response = await getDocuments(roomId);
            setDocuments(response.data);
        } catch (error) {
            console.error("[useDocuments] Failed to fetch documents:", error);
            setToast({ message: 'Could not load your document list.', type: 'error' });
        }
    }, [roomId, isAccessGranted, setToast]);

    // --- HANDLE CITATION CLICK ---
    const handleSourceClick = async (source) => {
        // 1. Start Loading
        setIsPdfLoading(true);
        setPdfUrl(null);

        try {
            let documentId = source.id;

            // [CRITICAL FIX] Lookup Logic
            // Citations from text only have 'name', not 'id'. We must find the ID.
            if (!documentId && source.name) {
                const normalizedSourceName = source.name.trim().toLowerCase();

                const foundDoc = documents.find(d =>
                    d.name.trim().toLowerCase() === normalizedSourceName
                );

                if (foundDoc) {
                    documentId = foundDoc.id;
                    console.log(`[useDocuments] Resolved citation "${source.name}" to ID: ${documentId}`);
                } else {
                    console.warn(`[useDocuments] Source not found in library: ${source.name}`);
                    throw new Error(`Document "${source.name}" not found in this room.`);
                }
            }

            if (!documentId) {
                throw new Error("Invalid document reference.");
            }

            // 2. Fetch Blob
            const pdfBlob = await getDocument(documentId);
            const url = URL.createObjectURL(pdfBlob);

            // 3. Set State
            setPdfUrl(url);
            // Ensure page number is parsed as integer
            const pageNum = source.page ? parseInt(source.page, 10) : null;
            setCurrentHighlight(pageNum ? { pageNumber: pageNum } : null);

        } catch (error) {
            console.error("[useDocuments] Failed to load document:", error);
            setToast({
                message: error.message || 'Could not load the referenced document.',
                type: 'error'
            });
        } finally {
            setIsPdfLoading(false);
        }
    };

    // --- HANDLE DIRECT LIBRARY OPEN ---
    const handleOpenDocument = async (documentId, documentName) => {
        setIsPdfLoading(true);
        setPdfUrl(null);
        setCurrentHighlight(null);
        try {
            const pdfBlob = await getDocument(documentId);
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
        } catch (error) {
            console.error("[useDocuments] Failed to load document:", error);
            setToast({ message: 'Could not load the document.', type: 'error' });
        } finally {
            setIsPdfLoading(false);
        }
    };

    const closePdfViewer = () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        setCurrentHighlight(null);
    };

    return {
        documents,
        fetchDocuments,
        pdfUrl,
        isPdfLoading,
        currentHighlight,
        showDocuments,
        setShowDocuments,
        handleSourceClick,
        handleOpenDocument,
        closePdfViewer
    };
};