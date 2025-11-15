// frontend/src/pages/ChatRoomPage/hooks/useDocuments.js

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

    const fetchDocuments = useCallback(async () => {
        if (!roomId || !isAccessGranted) return;
        console.log(`[useDocuments] Fetching documents for room ${roomId}...`);
        try {
            const response = await getDocuments(roomId); 
            setDocuments(response.data);
        } catch (error) {
            console.error("[useDocuments] Failed to fetch documents:", error);
            setToast({ message: 'Could not load your document list.', type: 'error' });
        }
    }, [roomId, isAccessGranted, setToast]);

    const handleSourceClick = async (source) => {
        setIsPdfLoading(true);
        setPdfUrl(null);
        try {
            const documentId = source.id;
            const pdfBlob = await getDocument(documentId);
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
            setCurrentHighlight(source.page ? { pageNumber: source.page } : null);
        } catch (error) {
            console.error("[useDocuments] Failed to load document:", error);
            setToast({ message: 'Could not load the document.', type: 'error' });
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleOpenDocument = async (documentId) => {
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