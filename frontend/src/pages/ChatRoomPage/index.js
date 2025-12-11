// frontend/src/pages/ChatRoomPage/index.js
// --------------------------------------------------------
// [FIXED] Layout: Removed excessive bottom padding for tighter UI
// --------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deleteDocument } from '../../services/api';
import { toast } from 'react-hot-toast';
import { FiAlertTriangle, FiClock } from 'react-icons/fi';
import { motion } from 'framer-motion';

// --- COMPONENTS ---
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import DocumentLibraryModal from './components/DocumentLibraryModal';
import ChatSearchModal from './components/ChatSearchModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import PdfViewer from '../../PdfViewer';

// --- HOOKS ---
import { useRoomAccess } from './hooks/useRoomAccess';
import { useConversations } from './hooks/useConversations';
import { useDocuments } from './hooks/useDocuments';
import { useFileUpload } from './hooks/useFileUpload';
import { useChatStream } from './hooks/useChatStream';

// --- JIT ACCESS MODAL ---
const JitAccessModal = ({ status, onGoBack }) => {
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

const ChatRoomPage = () => {
    const { roomId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    // --- STATE ---
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [chatMode, setChatMode] = useState('STANDARD');

    // Modals
    const [isDocLibraryOpen, setIsDocLibraryOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    // Refs
    const isSearchingRef = useRef(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- HOOKS ---
    const { accessStatus, roomName, checkRoomAccess, setRoomName } = useRoomAccess(roomId);

    // Derived state for safe fetching
    const isAccessGranted = accessStatus === 'granted';

    const { fetchConversations } = useConversations(
        roomId, roomName, isAccessGranted,
        isSearchingRef,
        setMessages, activeConversationId, setActiveConversationId
    );

    const {
        documents, fetchDocuments, pdfUrl, isPdfLoading, currentHighlight,
        handleSourceClick, handleOpenDocument, closePdfViewer
    } = useDocuments(roomId, isAccessGranted, toast);

    const { isUploading, handleFileUpload, handleStopUpload } = useFileUpload(roomId, toast, fetchDocuments);

    const { handleSearch, handleStopGeneration, handleEditMessage } = useChatStream(
        roomId, activeConversationId, setActiveConversationId, fetchConversations,
        toast, setInputMessage, setMessages, isSearchingRef
    );

    // --- INITIALIZATION ---
    useEffect(() => {
        checkRoomAccess();
    }, [roomId, checkRoomAccess]);

    useEffect(() => {
        if (isAccessGranted) {
            fetchDocuments();
            fetchConversations();
        }
    }, [isAccessGranted, fetchDocuments, fetchConversations]);

    // --- WELCOME MESSAGE ---
    useEffect(() => {
        if (isAccessGranted && roomName && messages.length === 0) {
            const timer = setTimeout(() => {
                setMessages(prev => {
                    if (prev.length === 0) {
                        return [{
                            sender: 'ai',
                            text: `Welcome to **${roomName}**. I am ready to analyze your documents.`
                        }];
                    }
                    return prev;
                });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isAccessGranted, roomName]);


    // --- HANDLERS ---
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    const onSendMessage = (e) => {
        e?.preventDefault();
        handleSearch(inputMessage, chatMode);
        setInputMessage('');
    };

    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Copied to clipboard!');
        });
    };

    const handleDeleteDocumentWrapper = async (docId) => {
        if (window.confirm('Are you sure you want to permanently delete this document?')) {
            try {
                await deleteDocument(docId);
                toast.success('Document deleted.');
                fetchDocuments();
            } catch (err) {
                toast.error('Failed to delete document.');
            }
        }
    };

    const isThinking = isSearchingRef.current || (messages.length > 0 && messages[messages.length - 1].isLoading);

    return (
        <div className="flex h-screen bg-[#1e1e1e] text-white overflow-hidden">
            <div className="flex-1 flex flex-col h-full relative">
                {!isAccessGranted ? (
                    <div className="flex-grow flex items-center justify-center relative">
                        {accessStatus === 'checking' ? <LoadingSpinner /> : <JitAccessModal status={accessStatus} onGoBack={() => navigate('/dashboard')} />}
                    </div>
                ) : (
                    <>
                        <ChatHeader
                            title={roomName}
                            subtitle={chatMode === 'DEEP_RESEARCH' ? 'Deep Research Mode' : 'Standard Analysis'}
                            documentCount={documents.length}
                            onOpenLibrary={() => setIsDocLibraryOpen(true)}
                            onShowSearch={() => setIsSearchModalOpen(true)}
                            isUploading={isUploading}
                        />

                        {/* [LAYOUT FIX] Main Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 sm:px-4">
                            <MessageList
                                messages={messages}
                                handleSourceClick={handleSourceClick}
                                isSearching={isThinking}
                                handleEditMessage={handleEditMessage}
                                handleCopyToClipboard={handleCopyToClipboard}
                            />
                            <div ref={messagesEndRef} />
                        </div>

                        {/* [LAYOUT FIX] Removed pb-4, allowing Input to sit naturally */}
                        <div className="w-full bg-transparent">
                            <ChatInput
                                inputMessage={inputMessage}
                                setInputMessage={setInputMessage}
                                handleSendMessage={onSendMessage}
                                isLoading={isThinking}
                                isUploading={isUploading}
                                fileInputRef={fileInputRef}
                                handleFileUpload={handleFileUpload}
                                handleStopUpload={handleStopUpload}
                                chatMode={chatMode}
                                setChatMode={setChatMode}
                                onStopGeneration={handleStopGeneration}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* --- MODALS --- */}
            {isDocLibraryOpen && (
                <DocumentLibraryModal
                    isOpen={isDocLibraryOpen}
                    roomId={roomId}
                    documents={documents}
                    onClose={() => setIsDocLibraryOpen(false)}
                    onView={(doc) => { handleOpenDocument(doc.id, doc.name); setIsDocLibraryOpen(false); }}
                    onDelete={handleDeleteDocumentWrapper}
                />
            )}

            {isSearchModalOpen && (
                <ChatSearchModal
                    isOpen={isSearchModalOpen}
                    onClose={() => setIsSearchModalOpen(false)}
                    setToast={toast}
                />
            )}

            {(isPdfLoading || pdfUrl) && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60]">
                    {isPdfLoading ? (
                        <div className="text-white flex flex-col items-center">
                            <LoadingSpinner />
                            <span className="mt-4 text-sm font-medium">Decrypting Document...</span>
                        </div>
                    ) : (
                        <PdfViewer
                            fileUrl={pdfUrl}
                            onClose={closePdfViewer}
                            highlight={currentHighlight}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatRoomPage;