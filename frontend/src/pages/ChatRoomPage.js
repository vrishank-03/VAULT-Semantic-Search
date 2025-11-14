// frontend/src/pages/ChatRoomPage.js
// Final Correction

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    uploadDocument,
    search,
    getDocument,
    getDocuments,
    createNewConversation,
    getConversations,
    getConversationHistory,
    logRoomEntry,
    joinRoom
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import PdfViewer from '../PdfViewer';
import ReactMarkdown from 'react-markdown';
import {
    FiPaperclip,
    FiSend,
    FiChevronDown,
    FiChevronUp,
    FiCopy,
    FiSquare,
    FiEdit2,
    FiAlertTriangle,
    FiCheckCircle,
    FiClock,
    FiArrowLeft,
    FiPlus,
    FiMessageSquare
} from 'react-icons/fi';
import Toast from '../Toast';
import { motion } from 'framer-motion';
import ProcessingAnimation from '../components/ProcessingAnimation';
import ThinkingAnimation from '../components/ThinkingAnimation';
import logo from '../assets/logo.png';
import LoadingSpinner from '../components/LoadingSpinner';

// Import layout context
import { useLayout } from '../context/LayoutContext';

const getInitialMessages = (roomName = "this chat room") => {
    return [{ sender: 'ai', text: `Welcome to ${roomName}. Upload a document or ask me a question about your knowledge base.` }];
};

// --- [JIT Access Modal Component -UNCHANGED] ---
const JitAccessModal = ({ status, onGoBack }) => {
    const getStatusContent = () => {
        switch (status) {
            case 'pending':
                return {
                    icon: <FiClock className="text-yellow-500" size={48} />,
                    title: "Access Pending",
                    message: "Your request to access this room is pending approval from the room owner."
                };
            case 'rejected':
                return {
                    icon: <FiAlertTriangle className="text-red-500" size={48} />,
                    title: "Access Rejected",
                    message: "Your request to access this room was rejected by the room owner. Please contact them for more information."
                };
            default:
                return {
                    icon: <FiAlertTriangle className="text-gray-500" size={48} />,
                    title: "Access Denied",
                    message: "You do not have permission to view this room."
                };
        }
    };
    const { icon, title, message } = getStatusContent();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900 text-center"
            >
                <div className="flex justify-center mb-4">{icon}</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                <p className="text-gray-600 dark:text-gray-300">{message}</p>
                <button
                    onClick={onGoBack}
                    className="w-full px-4 py-3 mt-4 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                    Back to Dashboard
                </button>
            </motion.div>
        </div>
    );
};
// --- [END JIT Access Modal] ---


function ChatRoomPage() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    
    const { setSidebarContent } = useLayout();
    
    // --- [All states unchanged] ---
    const [accessStatus, setAccessStatus] = useState('checking');
    const [roomName, setRoomName] = useState(`Room ${roomId}`); 
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [currentHighlight, setCurrentHighlight] = useState(null);
    const [toast, setToast] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [showDocuments, setShowDocuments] = useState(false);

    // --- [All refs unchanged] ---
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const searchAbortControllerRef = useRef(null);
    const uploadAbortControllerRef = useRef(null);
    const mainInputRef = useRef(null);

    const { user } = useAuth();

    // --- [All logic functions - Full implementation] ---
    const fetchDocuments = useCallback(async () => {
        if (!roomId) return;
        console.log(`[CHAT_ROOM_LOG] Fetching documents (for room ${roomId})...`);
        try {
            const response = await getDocuments(roomId); 
            setDocuments(response.data);
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            setToast({ message: 'Could not load your document list.', type: 'error' });
        }
    }, [roomId]);

    const fetchConversations = useCallback(async () => {
        if (!roomId) return;
        console.log(`[CHAT_ROOM_LOG] Fetching conversations (for room ${roomId})...`);
        try {
            const response = await getConversations(roomId); 
            setConversations(response.data);
            console.log(`[CHAT_ROOM_LOG] Successfully fetched ${response.data.length} conversations.`);
        } catch (error) {
            console.error("[CHAT_ROOM_LOG] Failed to fetch conversations:", error);
            setToast({ message: 'Could not load your chat history.', type: 'error' });
        }
    }, [roomId]);

    const checkRoomAccess = useCallback(async (currentRoomId) => {
        console.log(`[CHAT_ROOM_ACCESS] Checking access for room ID: ${currentRoomId}...`);
        try {
            const response = await joinRoom(currentRoomId);
            const status = response.data.status;
            
            console.log(`[CHAT_ROOM_ACCESS] API response: ${status}`);
            
            if (status === 'granted') {
                setAccessStatus('granted');
                logRoomEntry(currentRoomId);
                
                // TODO: Fetch room details from API for *real* name
                const currentRoomName = `Room ${currentRoomId}`; // Placeholder
                setRoomName(currentRoomName);
                setMessages(getInitialMessages(currentRoomName));
                setActiveConversationId(null);
                
                fetchDocuments();
                fetchConversations();
            } else {
                setAccessStatus(status || 'denied');
            }
        } catch (error) {
            console.error("[CHAT_ROOM_ACCESS_FAIL] Failed to check room access:", error);
            const status = error.response?.data?.status;
            if (status) {
                setAccessStatus(status);
            } else {
                setToast({ message: error.response?.data?.message || 'Error joining room.', type: 'error' });
                navigate('/dashboard');
            }
        }
    }, [navigate, fetchDocuments, fetchConversations]);

    const handleSearch = async (e) => {
        e.preventDefault();
        console.log("[CHAT_ROOM_LOG] handleSearch triggered.");
        if (!input.trim() || isSearching) return;

        console.log("[CHAT_ROOM_LOG] Creating new Search AbortController.");
        const controller = new AbortController();
        searchAbortControllerRef.current = controller;

        const userMessage = { sender: 'user', text: input };
        const currentHistory = [...messages, userMessage];
        setMessages([...currentHistory, { sender: 'ai', text: 'Thinking...', isLoading: true }]);

        const currentInput = input;
        setInput('');
        setIsSearching(true);

        let convoId = activeConversationId;

        try {
            if (!convoId) {
                console.log("[CHAT_ROOM_LOG] No active conversation. Creating a new one first...");
                const response = await createNewConversation(roomId);
                convoId = response.data.conversation_id;
                setActiveConversationId(convoId);
                console.log(`[CHAT_ROOM_LOG] New conversation automatically created with ID: ${convoId}`);
                fetchConversations();
            }

            console.log(`[CHAT_ROOM_LOG] Calling search() API for Convo ID: ${convoId} in room ${roomId}...`);
            const result = await search(currentInput, currentHistory, convoId, roomId, controller.signal);

            const responseData = result.data;
            if (!responseData || typeof responseData.answer === 'undefined') {
                throw new Error("Invalid response structure from server.");
            }

            console.log("[CHAT_ROOM_LOG] Search successful. Got AI response.");
            const aiResponse = { sender: 'ai', text: responseData.answer, results: responseData };
            setMessages(prev => [...prev.slice(0, -1), aiResponse]);

        } catch (error) {
            console.error("[CHAT_ROOM_LOG] Search encountered an error:", error);
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                console.log("[CHAT_ROOM_LOG] Search request was successfully aborted by user.");
                const errorResponse = { sender: 'system', text: "Generation stopped." };
                setMessages(prev => [...prev.slice(0, -1), errorResponse]);
            } else if (error.config && error.config.url.includes('/api/chat/new')) {
                console.error("[CHAT_ROOM_LOG] CRITICAL: Failed to create initial conversation.");
                setToast({ message: 'A new chat session could not be started. Please refresh.', type: 'error' });
                setMessages(prev => prev.slice(0, -2));
            } else {
                const errorText = error.response?.data?.message || 'Sorry, I encountered an error.';
                setToast({ message: errorText, type: 'error' });
                const errorResponse = { sender: 'ai', text: "My apologies, I seem to have encountered a problem. Please try your question again in sometime." };
                setMessages(prev => [...prev.slice(0, -1), errorResponse]);
            }
        } finally {
            console.log("[CHAT_ROOM_LOG] Search finalized. Cleaning up controller and state.");
            setIsSearching(false);
            searchAbortControllerRef.current = null;
        }
    };

    const handleStopGeneration = () => {
        console.log("[CHAT_ROOM_LOG] handleStopGeneration triggered.");
        if (searchAbortControllerRef.current) {
            searchAbortControllerRef.current.abort();
            console.log("[CHAT_ROOM_LOG] Abort signal sent for search.");
        } else {
            console.warn("[CHAT_ROOM_LOG] Stop Generation clicked, but no Search AbortController found.");
        }
    };

    const handleStopUpload = () => {
        console.log("[CHAT_ROOM_LOG] handleStopUpload triggered.");
        if (uploadAbortControllerRef.current) {
            uploadAbortControllerRef.current.abort();
            console.log("[CHAT_ROOM_LOG] Abort signal sent for upload.");
        } else {
            console.warn("[CHAT_ROOM_LOG] Stop Upload clicked, but no Upload AbortController found.");
        }
    };

    const handleEditMessage = (messageIndex) => {
        console.log(`[CHAT_ROOM_LOG] handleEditMessage triggered for index: ${messageIndex}`);
        const messageToEdit = messages[messageIndex];
        if (messageToEdit.sender !== 'user') {
            console.warn(`[CHAT_ROOM_LOG] Edit attempt on non-user message index ${messageIndex}.`);
            return;
        }
        console.log(`[CHAT_ROOM_LOG] Setting input to: "${messageToEdit.text}"`);
        setInput(messageToEdit.text);
        console.log(`[CHAT_ROOM_LOG] Rewinding message history to index ${messageIndex}.`);
        setMessages(prevMessages => prevMessages.slice(0, messageIndex));
        mainInputRef.current?.focus();
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        console.log("[CHAT_ROOM_LOG] handleFileUpload triggered.");
        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;
        setIsUploading(true);
        setToast(null);

        try {
            console.log(`[CHAT_ROOM_LOG] Calling uploadDocument() API for room ${roomId} with signal.`);
            const result = await uploadDocument(files, roomId, controller.signal);
            
            console.log("[CHAT_ROOM_LOG] Upload successful.");
            setToast({ message: `Upload successful. ${result.data.documentIds.length} document(s) processed.`, type: 'success' });
            fetchDocuments();
        } catch (error) {
            console.error("[CHAT_ROOM_LOG] Upload encountered an error:", error);
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                 console.log("[CHAT_ROOM_LOG] Upload request was successfully aborted by user.");
                 setToast({ message: "Upload stopped.", type: 'warning' });
            } else if (error.response && error.response.status === 409) {
                console.warn("[CHAT_ROOM_LOG] Duplicate file upload detected.");
                setToast({ message: error.response.data.error, type: 'error' });
            } else {
                if (error.response && error.response.status === 403) {
                     console.warn("[CHAT_ROOM_LOG] Upload forbidden for user.");
                     setToast({ message: "You do not have permission to upload documents.", type: 'error' });
                } else {
                     console.error("[CHAT_ROOM_LOG] Generic upload failure.");
                     setToast({ message: `Upload failed. Please try again.`, type: 'error' });
                }
            }
        } finally {
            console.log("[CHAT_ROOM_LOG] Upload finalized. Cleaning up controller and state.");
            setIsUploading(false);
            uploadAbortControllerRef.current = null;
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
                console.log("[CHAT_ROOM_LOG] File input cleared.");
            }
        }
    };

    const handleSourceClick = async (source) => {
        setIsPdfLoading(true);
        setPdfUrl(null);
        try {
            const documentId = source.metadata.documentId;
            const pdfBlob = await getDocument(documentId);
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
            setCurrentHighlight(source.metadata && source.metadata.pageNumber ? {
                pageNumber: source.metadata.pageNumber,
                textToHighlight: source.text
            } : null);
        } catch (error) {
            setToast({ message: 'Could not load the protected PDF.', type: 'error' });
        } finally {
            setIsPdfLoading(false);
        }
    };

    const closePdfViewer = () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        setCurrentHighlight(null);
    };

    const handleOpenDocument = async (documentId, documentName) => {
        console.log(`[CHAT_ROOM_LOG] handleOpenDocument triggered for docId: ${documentId}, name: ${documentName}`);
        setIsPdfLoading(true);
        setPdfUrl(null);
        setCurrentHighlight(null);
        try {
            console.log(`[CHAT_ROOM_LOG] Calling getDocument(${documentId})`);
            const pdfBlob = await getDocument(documentId);
            const url = URL.createObjectURL(pdfBlob);
            console.log(`[CHAT_ROOM_LOG] PDF Blob URL created. Setting PDF URL.`);
            setPdfUrl(url);
        } catch (error) {
            console.error("Failed to load document:", error);
            setToast({ message: 'Could not load the document.', type: 'error' });
        } finally {
            console.log(`[CHAT_ROOM_LOG] Setting isPdfLoading to false.`);
            setIsPdfLoading(false);
        }
    };

    const handleCopyToClipboard = (text) => {
        console.log(`[CHAT_ROOM_LOG] Attempting to copy text: "${text}"`);
        if (!navigator.clipboard) {
            console.error('[CHAT_ROOM_LOG] Clipboard API not available.');
            setToast({ message: 'Clipboard API is not available in your browser.', type: 'error' });
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            console.log(`[CHAT_ROOM_LOG] Successfully copied to clipboard.`);
            const toastMessage = `Copied "${text.length > 20 ? text.substring(0, 20) + '...' : text}" to clipboard!`;
            setToast({ message: toastMessage, type: 'success' });
        }, (err) => {
            console.error('[CHAT_ROOM_LOG] Failed to copy text: ', err);
            setToast({ message: 'Failed to copy text.', type: 'error' });
        });
    };

    const handleNewChat = useCallback(async () => {
        console.log("[CHAT_ROOM_LOG] handleNewChat triggered.");
        const hasUserMessages = messages.some(m => m.sender === 'user');

        if (!hasUserMessages && activeConversationId !== null) {
            console.log("[CHAT_ROOM_LOG] No user messages in current chat. No new chat created.");
            return;
        }

        console.log("[CHAT_ROOM_LOG] Creating new conversation via API...");
        try {
            const response = await createNewConversation(roomId);
            const newConversation = response.data;
            console.log("[CHAT_ROOM_LOG] Successfully created new conversation. ID:", newConversation.conversation_id);
            setActiveConversationId(newConversation.conversation_id);
            setMessages(getInitialMessages(roomName));
            fetchConversations();
            setToast({ message: 'New chat created!', type: 'success' });
        } catch (error) {
            console.error("[CHAT_ROOM_LOG] Failed to create new conversation:", error);
            setToast({ message: 'Could not create a new chat. Please try again.', type: 'error' });
        }
    }, [roomId, roomName, messages, activeConversationId, fetchConversations]);

    const handleSelectConversation = useCallback(async (selectedId) => {
        console.log(`[CHAT_ROOM_LOG] handleSelectConversation triggered for ID: ${selectedId}`);

        if (selectedId === activeConversationId) {
            console.log("[CHAT_ROOM_LOG] Selected conversation is already active. No action needed.");
            return;
        }

        setActiveConversationId(selectedId);
        setMessages([{ sender: 'system', text: 'Loading chat history...' }]);

        try {
            console.log(`[CHAT_ROOM_LOG] Calling getConversationHistory(${selectedId})...`);
            const response = await getConversationHistory(selectedId);
            const history = response.data;
            console.log(`[CHAT_ROOM_LOG] Successfully fetched history with ${history.length} messages.`);
            setMessages(history.length > 0 ? history : getInitialMessages(roomName));
        } catch (error) {
            console.error(`[CHAT_ROOM_LOG] Failed to fetch history for conversation ${selectedId}:`, error);
            setToast({ message: 'Could not load the selected chat history.', type: 'error' });
            setMessages(getInitialMessages(roomName));
        }
    }, [activeConversationId, roomName]);

    // --- [Unchanged useEffects] ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (roomId) {
            console.log(`[CHAT_ROOM_EFFECT] New room ID: ${roomId}. Checking access...`);
            setAccessStatus('checking');
            checkRoomAccess(roomId);
        }
    }, [roomId, checkRoomAccess]);

    // --- [Sidebar content useEffect - unchanged] ---
    useEffect(() => {
        if (accessStatus === 'granted') {
            setSidebarContent(
                <div className="flex flex-col flex-grow overflow-hidden">
                    <Link
                        to="/dashboard"
                        className="flex items-center justify-center w-full px-4 py-3 mb-4 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900 rounded-lg transition-all duration-200"
                    >
                        <FiArrowLeft className="mr-2" size={18} /> Back to Dashboard
                    </Link>
                    <button
                        onClick={handleNewChat}
                        className="flex items-center justify-center w-full px-4 py-3 mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:-translate-y-0.5"
                    >
                        <FiPlus className="mr-2" size={20} /> New Chat
                    </button>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        {roomName} History
                    </h3>
                    <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {conversations && conversations.length > 0 ? (
                            conversations.map((convo) => (
                                <button
                                    key={convo.conversation_id}
                                    onClick={() => handleSelectConversation(convo.conversation_id)}
                                    className={`flex items-center w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors duration-150 ${
                                        convo.conversation_id === activeConversationId ? 'bg-gray-200 dark:bg-gray-700' : ''
                                    }`}
                                    title={convo.title}
                                >
                                    <FiMessageSquare className="mr-3 flex-shrink-0" size={16} />
                                    <span className="truncate">{convo.title}</span>
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2 italic">
                                No chat history yet.
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        return () => setSidebarContent(null);
    }, [
        setSidebarContent, 
        accessStatus, 
        roomName, 
        conversations, 
        activeConversationId, 
        handleNewChat, 
        handleSelectConversation
    ]);


    return (
        <>
            {isUploading && <ProcessingAnimation onStopUpload={handleStopUpload} />}

            {/* --- [MODIFIED] Page content now fills the <main> from AppLayout --- */}
            <div className="flex flex-col h-full">
                {/* --- Access Control Logic --- */}
                {accessStatus !== 'granted' ? (
                    <div className="flex-grow flex items-center justify-center relative">
                        {accessStatus === 'checking' && <LoadingSpinner />}
                        {(accessStatus === 'pending' || accessStatus === 'rejected' || accessStatus === 'denied') && (
                            <JitAccessModal status={accessStatus} onGoBack={() => navigate('/dashboard')} />
                        )}
                    </div>
                ) : (
                <>
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    
                    <header className="absolute top-4 right-4 sm:right-6 lg:right-8 z-10 flex items-center gap-4">
                        {documents.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowDocuments(!showDocuments)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Show Documents ({documents.length})
                                    {showDocuments ? <FiChevronUp /> : <FiChevronDown />}
                                </button>
                                {showDocuments && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl border dark:border-gray-700 z-20"
                                    >
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                                <tr>
                                                    <th scope="col" className="px-4 py-3 w-12">No.</th>
                                                    <th scope="col" className="px-4 py-3">Document Name</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {documents.map((doc, index) => (
                                                    <tr key={doc.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 group">
                                                        <td className="px-4 py-3">{index + 1}</td>
                                                        <td className="px-4 py-3 font-medium">
                                                            <div className="flex items-center justify-between">
                                                                <span
                                                                    className="truncate cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
                                                                    onClick={() => handleOpenDocument(doc.id, doc.name)}
                                                                    title={`Click to open ${doc.name}`}
                                                                >
                                                                    {doc.name}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleCopyToClipboard(doc.name)}
                                                                    className="ml-2 p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title={`Copy name "${doc.name}" to clipboard`}
                                                                >
                                                                    <FiCopy size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </header>
                    
                    {/* --- [MODIFIED] Corrected padding --- */}
                    {/* Removed pt-20 and h-12 spacer. Added standard page padding */}
                    <div className="flex-grow overflow-y-auto pb-40 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
                        {/* This spacer provides room for the floating "Show Documents" button */}
                        <div className="h-12" /> 
                        
                        <div className="max-w-4xl mx-auto space-y-8">
                            {/* --- [Messages .map() logic unchanged] --- */}
                            {messages.map((msg, index) => {
                                if (msg.sender === 'system') {
                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="flex justify-center items-center my-2"
                                        >
                                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                {msg.text}
                                            </span>
                                        </motion.div>
                                    );
                                }
                                const showLargeSpace = index > 0 && messages[index - 1].sender !== msg.sender;
                                return (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className={`flex items-start gap-4 group ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} ${showLargeSpace ? 'mt-8' : 'mt-2'}`}
                                    >
                                        {msg.sender === 'ai' && (
                                            <img src={logo} alt="VAULT Logo" className="w-10 h-10 pt-1 flex-shrink-0" />
                                        )}
                                        {msg.sender === 'user' && !isSearching && (
                                            <div className="flex items-center self-start pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditMessage(index)} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit and resend"> <FiEdit2 size={16} /> </button>
                                                <button onClick={() => handleCopyToClipboard(msg.text)} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" title="Copy question"> <FiCopy size={16} /> </button>
                                            </div>
                                        )}
                                        {msg.isLoading ? (
                                            <ThinkingAnimation />
                                        ) : (
                                            <div className={`max-w-2xl px-6 py-4 rounded-3xl shadow-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-lg'}`}>
                                                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2">
                                                    <ReactMarkdown>{msg.text || ""}</ReactMarkdown>
                                                </div>
                                                {msg.results && Array.isArray(msg.results.sources) && msg.results.sources.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-gray-200/20 dark:border-gray-700/50">
                                                        <details>
                                                            <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline">Show Sources ({msg.results.sources.length})</summary>
                                                            <div className="mt-2 space-y-3">
                                                                {msg.results.sources.map((source, i) => (
                                                                    <div key={i} className="p-3 bg-gray-100/50 dark:bg-gray-700/40 rounded-lg text-xs">
                                                                        <p className="font-semibold text-blue-700 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => handleSourceClick(source)}>
                                                                            Source from: {source.metadata.documentName || `Doc ID ${source.metadata.documentId}`} {source.metadata.pageNumber && `(Page ${source.metadata.pageNumber})`}
                                                                        </p>
                                                                        <div className="mt-1 text-gray-600 dark:text-gray-400 italic line-clamp-2 overflow-wrap-break-word">
                                                                            <ReactMarkdown>{`> ${source.text}`}</ReactMarkdown>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {msg.sender === 'user' && (
                                            user && user.pictureUrl ? (
                                                <img src={user.pictureUrl} alt="User Avatar" className="w-10 h-10 rounded-full flex-shrink-0 shadow-lg pt-1" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 shadow-lg flex items-center justify-center text-white font-semibold">
                                                    {user && user.email ? user.email.charAt(0).toUpperCase() : '?'}
                                                </div>
                                            )
                                        )}
                                        {msg.sender === 'ai' && !msg.isLoading && (
                                            <button onClick={() => handleCopyToClipboard(msg.text)} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pt-3" title="Copy response"> <FiCopy size={16} /> </button>
                                        )}
                                    </motion.div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* --- [Input bar - UNCHANGED] --- */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:px-8 from-white dark:from-gray-900 to-transparent bg-gradient-to-t">
                        <div className="max-w-4xl mx-auto">
                            <form onSubmit={handleSearch} className="flex items-center p-2 bg-white dark:bg-gray-800/70 dark:backdrop-blur-lg rounded-full shadow-2xl border border-gray-200 dark:border-gray-700">
                                
                                {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
                                    <>
                                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full"> <FiPaperclip size={22} /> </button>
                                        <input id="file-upload" ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf" />
                                    </>
                                )}
                                <input ref={mainInputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask VAULT" disabled={isSearching} className="flex-grow px-4 py-2 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none" />
                                {isSearching ? (
                                    <button type="button" onClick={handleStopGeneration} className="p-3 rounded-full text-gray-200 bg-gray-700 hover:bg-gray-600 transition-all duration-200 active:scale-90" title="Stop Generation"> <FiSquare size={22} /> </button>
                                ) : (
                                    <button type="submit" disabled={!input.trim()} className="p-3 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-gray-600 transition-all duration-200 active:scale-90" title="Send Message"> <FiSend size={22} /> </button>
                                )}
                            </form>
                        </div>
                    </div>
                </>
                )}
            </div>

            {/* --- [PDF Viewer Modal - UNCHANGED] --- */}
            {(isPdfLoading || pdfUrl) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    {isPdfLoading ? (
                        <div className="text-white text-lg">Loading secure document...</div>
                    ) : (
                        <PdfViewer fileUrl={pdfUrl} onClose={closePdfViewer} highlight={currentHighlight} />
                    )}
                </div>
            )}
        </>
    );
}

export default ChatRoomPage;