// frontend/src/pages/ChatRoomPage/index.js (Corrected)

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiClock } from 'react-icons/fi';
import { motion } from 'framer-motion';

// Import New Hooks
import { useRoomAccess } from './hooks/useRoomAccess';
import { useConversations } from './hooks/useConversations';
import { useDocuments } from './hooks/useDocuments';
import { useFileUpload } from './hooks/useFileUpload';
import { useChatStream } from './hooks/useChatStream';

// Import New Components
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import { getInitialMessages } from './utils/messageUtils';
import DocumentLibraryModal from './components/DocumentLibraryModal'; // [NEW] Import the modal

// Import Old Components
import Toast from '../../Toast';
import PdfViewer from '../../PdfViewer';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProcessingAnimation from '../../components/ProcessingAnimation';

// [NEW] Import the delete function from the API
import { deleteDocument } from '../../services/api'; 

// --- JitAccessModal (Omitted for brevity, it's unchanged) ---
const JitAccessModal = ({ status, onGoBack }) => {
    // ... same as before
    const getStatusContent = () => {
        switch (status) {
            case 'pending': return { icon: <FiClock className="text-yellow-500" size={48} />, title: "Access Pending", message: "Your request is pending approval." };
            case 'rejected': return { icon: <FiAlertTriangle className="text-red-500" size={48} />, title: "Access Rejected", message: "Your request was rejected." };
            default: return { icon: <FiAlertTriangle className="text-gray-500" size={48} />, title: "Access Denied", message: "You do not have permission." };
        }
    };
    const { icon, title, message } = getStatusContent();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900 text-center">
                <div className="flex justify-center mb-4">{icon}</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                <p className="text-gray-600 dark:text-gray-300">{message}</p>
                <button onClick={onGoBack} className="w-full px-4 py-3 mt-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    Back to Dashboard
                </button>
            </motion.div>
        </div>
    );
};
// --- End Modals ---


function ChatRoomPage() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    
    // --- Central State (Lifted from hooks) ---
    const [toast, setToast] = useState(null);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const mainInputRef = useRef(null); 

    // --- [NEW] State for the Document Library Modal ---
    const [isDocLibraryOpen, setIsDocLibraryOpen] = useState(false);

    // --- Custom Hooks ---
    const { accessStatus, roomName, checkRoomAccess, setRoomName } = useRoomAccess(roomId);
    const isAccessGranted = accessStatus === 'granted';

    const { fetchConversations } = useConversations(
        roomId, 
        roomName, 
        isAccessGranted, 
        isSearching,
        setMessages,
        activeConversationId,
        setActiveConversationId
    );
    
    const { 
        handleSearch, 
        handleStopGeneration, 
        handleEditMessage 
    } = useChatStream(
        roomId, 
        activeConversationId, 
        setActiveConversationId,
        fetchConversations,
        setToast,
        setInput,
        setMessages,
        setIsSearching
    );

    const {
        documents, fetchDocuments, pdfUrl, isPdfLoading, currentHighlight,
        // [MODIFIED] We no longer need showDocuments/setShowDocuments from this hook
        handleSourceClick, 
        handleOpenDocument, closePdfViewer
    } = useDocuments(roomId, isAccessGranted, setToast);

    const { isUploading, fileInputRef, handleFileUpload, handleStopUpload } = useFileUpload(
        roomId, 
        setToast, 
        fetchDocuments // Pass in the fetcher to refresh the list on success
    );
    
    // --- Initialization Effect (Unchanged) ---
    useEffect(() => {
        const initializeRoom = async () => {
            const currentRoomName = await checkRoomAccess();
            if (currentRoomName) {
                setRoomName(currentRoomName);
                setMessages(getInitialMessages(currentRoomName));
                fetchDocuments();
                fetchConversations();
            }
        };
        initializeRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]); 

    // --- Helper ---
    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setToast({ message: 'Copied to clipboard!', type: 'success' });
        }, (err) => {
            setToast({ message: 'Failed to copy text.', type: 'error' });
        });
    };
    
    const onEditMessage = (index) => {
        handleEditMessage(index);
        mainInputRef.current?.focus();
    };

    // --- [NEW] Delete Document Handler ---
    const handleDeleteDocument = async (docId) => {
        // Use a simple confirm dialog. For enterprise, use a dedicated ConfirmModal.
        if (window.confirm('Are you sure you want to permanently delete this document? This is irreversible.')) {
            try {
                await deleteDocument(docId);
                setToast({ message: 'Document successfully deleted.', type: 'success' });
                fetchDocuments(); // Refresh the document list
            } catch (err) {
                console.error("Failed to delete document:", err);
                setToast({ message: err.response?.data?.message || 'Failed to delete document.', type: 'error' });
            }
        }
    };

    // --- [NEW] View Document Handler (for Modal) ---
    const handleViewDocument = (doc) => {
        handleOpenDocument(doc.id, doc.name);
        setIsDocLibraryOpen(false); // Close modal after clicking
    };

    return (
        <>
            {isUploading && <ProcessingAnimation onStopUpload={handleStopUpload} />}

            <div className="flex flex-col h-full">
                {/* --- Access Control Logic (Unchanged) --- */}
                {!isAccessGranted ? (
                    <div className="flex-grow flex items-center justify-center relative">
                        {accessStatus === 'checking' && <LoadingSpinner />}
                        {accessStatus !== 'checking' && (
                            <JitAccessModal status={accessStatus} onGoBack={() => navigate('/dashboard')} />
                        )}
                    </div>
                ) : (
                <>
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    
                    {/* [MODIFIED] ChatHeader props are simplified */}
                    <ChatHeader
                        documentCount={documents.length}
                        onShowDocuments={() => setIsDocLibraryOpen(true)}
                    />
                    
                    <MessageList
                        messages={messages}
                        isSearching={isSearching}
                        handleEditMessage={onEditMessage} 
                        handleCopyToClipboard={handleCopyToClipboard}
                        handleSourceClick={handleSourceClick}
                    />

                    <ChatInput
                        input={input}
                        setInput={setInput}
                        isSearching={isSearching}
                        isUploading={isUploading}
                        handleSearch={handleSearch}
                        handleStopGeneration={handleStopGeneration}
                        handleFileUpload={handleFileUpload}
                        fileInputRef={fileInputRef}
                        mainInputRef={mainInputRef}
                    />
                </>
                )}
            </div>

            {/* --- PDF Viewer Modal (Unchanged) --- */}
            {(isPdfLoading || pdfUrl) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    {isPdfLoading ? (
                        <div className="text-white text-lg flex flex-col items-center">
                            <LoadingSpinner />
                            <span className="mt-2">Loading secure document...</span>
                        </div>
                    ) : (
                        <PdfViewer fileUrl={pdfUrl} onClose={closePdfViewer} highlight={currentHighlight} />
                    )}
                </div>
            )}

            {/* --- [NEW] Document Library Modal --- */}
            <DocumentLibraryModal
                isOpen={isDocLibraryOpen}
                onClose={() => setIsDocLibraryOpen(false)}
                documents={documents}
                onView={handleViewDocument}
                onDelete={handleDeleteDocument}
            />
        </>
    );
}

export default ChatRoomPage;