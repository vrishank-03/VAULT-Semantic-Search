import React, { useState, useEffect, useRef } from 'react';
// --- MODIFIED IMPORT: Added getConversationHistory ---
import { uploadDocument, search, getDocument, getUserInfo, getDocuments, createNewConversation, getConversations, getConversationHistory } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PdfViewer from '../PdfViewer';
import ReactMarkdown from 'react-markdown';
import { FiPaperclip, FiSend, FiChevronDown, FiChevronUp, FiCopy, FiSquare, FiEdit2 } from 'react-icons/fi';
import Toast from '../Toast';
import Sidebar from '../components/Sidebar';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { motion } from 'framer-motion';
import ProcessingAnimation from '../components/ProcessingAnimation';
import ThinkingAnimation from '../components/ThinkingAnimation';
import logo from '../assets/logo.png';

const getInitialMessages = () => {
    return [{ sender: 'ai', text: 'Welcome to VAULT. Upload a document or ask me a question about your knowledge base.' }];
};

function Dashboard() {
    const [messages, setMessages] = useState(getInitialMessages);
    const [input, setInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [activeConversationId, setActiveConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [currentHighlight, setCurrentHighlight] = useState(null);

    const [toast, setToast] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const searchAbortControllerRef = useRef(null);
    const uploadAbortControllerRef = useRef(null);

    const mainInputRef = useRef(null);

    const { user } = useAuth();

    const [documents, setDocuments] = useState([]);
    const [showDocuments, setShowDocuments] = useState(false);

    const fetchDocuments = async () => {
        try {
            const response = await getDocuments();
            setDocuments(response.data);
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            setToast({ message: 'Could not load your document list.', type: 'error' });
        }
    };

    const fetchConversations = async () => {
        console.log("[LOG] Dashboard: Attempting to fetch conversations...");
        try {
            const response = await getConversations();
            setConversations(response.data);
            console.log(`[LOG] Dashboard: Successfully fetched ${response.data.length} conversations.`);
        } catch (error) {
            console.error("[LOG] Dashboard: Failed to fetch conversations:", error);
            setToast({ message: 'Could not load your chat history.', type: 'error' });
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        fetchDocuments();
        fetchConversations();
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        console.log("[LOG] Dashboard: handleSearch triggered.");
        if (!input.trim() || isSearching) return;

        console.log("[LOG] Dashboard: Creating new Search AbortController.");
        const controller = new AbortController();
        searchAbortControllerRef.current = controller;

        const userMessage = { sender: 'user', text: input };
        const currentHistory = [...messages, userMessage];
        // Add "Thinking..." immediately for responsiveness
        setMessages([...currentHistory, { sender: 'ai', text: 'Thinking...', isLoading: true }]);

        const currentInput = input;
        setInput('');
        setIsSearching(true);

        let convoId = activeConversationId; // Use a local variable

        try {
             // Check if it's the first message of a new chat session (not just a new convo)
            if (!convoId) {
                console.log("[LOG] Dashboard: No active conversation. Creating a new one first...");
                const response = await createNewConversation();
                convoId = response.data.conversation_id;
                setActiveConversationId(convoId); // Update state *after* successful creation
                console.log(`[LOG] Dashboard: New conversation automatically created with ID: ${convoId}`);
                fetchConversations(); // Refresh list in sidebar
            }

            console.log(`[LOG] Dashboard: Calling search() API for Convo ID: ${convoId} with signal.`);
            const result = await search(currentInput, currentHistory, convoId, controller.signal);

            const responseData = result.data;
            if (!responseData || typeof responseData.answer === 'undefined') {
                throw new Error("Invalid response structure from server.");
            }

            console.log("[LOG] Dashboard: Search successful. Got AI response.");
            const aiResponse = { sender: 'ai', text: responseData.answer, results: responseData };
             // Replace "Thinking..." with the actual response
            setMessages(prev => [...prev.slice(0, -1), aiResponse]);

        } catch (error) {
            console.error("[LOG] Dashboard: Search encountered an error:", error);

            // Handle abort specifically
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                console.log("[LOG] Dashboard: Search request was successfully aborted by user.");
                const errorResponse = { sender: 'system', text: "Generation stopped." };
                 // Replace "Thinking..." with the system message
                setMessages(prev => [...prev.slice(0, -1), errorResponse]);
            } else if (error.config && error.config.url.endsWith('/api/chat/new')) {
                 // Handle failure to create the *initial* conversation
                console.error("[LOG] Dashboard: CRITICAL: Failed to create initial conversation.");
                setToast({ message: 'A new chat session could not be started. Please refresh.', type: 'error' });
                 // Remove the user message and "Thinking..."
                setMessages(prev => prev.slice(0, -2));
            } else {
                 // Generic error during search
                const errorText = error.response?.data?.message || 'Sorry, I encountered an error.';
                setToast({ message: errorText, type: 'error' });
                const errorResponse = { sender: 'ai', text: "My apologies, I seem to have encountered a problem. Please try your question again in sometime." };
                 // Replace "Thinking..." with the error message
                setMessages(prev => [...prev.slice(0, -1), errorResponse]);
            }
        } finally {
            console.log("[LOG] Dashboard: Search finalized. Cleaning up controller and state.");
            setIsSearching(false);
            searchAbortControllerRef.current = null;
        }
    };

    const handleStopGeneration = () => {
        console.log("[LOG] Dashboard: handleStopGeneration triggered.");
        if (searchAbortControllerRef.current) {
            searchAbortControllerRef.current.abort();
            console.log("[LOG] Dashboard: Abort signal sent for search.");
        } else {
            console.warn("[LOG] Dashboard: Stop Generation clicked, but no Search AbortController found.");
        }
    };

    const handleStopUpload = () => {
        console.log("[LOG] Dashboard: handleStopUpload triggered.");
        if (uploadAbortControllerRef.current) {
            uploadAbortControllerRef.current.abort();
            console.log("[LOG] Dashboard: Abort signal sent for upload.");
        } else {
            console.warn("[LOG] Dashboard: Stop Upload clicked, but no Upload AbortController found.");
        }
    };

    const handleEditMessage = (messageIndex) => {
        console.log(`[LOG] Dashboard: handleEditMessage triggered for index: ${messageIndex}`);
        const messageToEdit = messages[messageIndex];

        if (messageToEdit.sender !== 'user') {
            console.warn(`[LOG] Dashboard: Edit attempt on non-user message index ${messageIndex}.`);
            return;
        }

        console.log(`[LOG] Dashboard: Setting input to: "${messageToEdit.text}"`);
        setInput(messageToEdit.text);

        console.log(`[LOG] Dashboard: Rewinding message history to index ${messageIndex}.`);
        setMessages(prevMessages => prevMessages.slice(0, messageIndex));

        mainInputRef.current?.focus();
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        console.log("[LOG] Dashboard: handleFileUpload triggered.");
        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;
        setIsUploading(true);
        setToast(null);

        try {
            console.log("[LOG] Dashboard: Calling uploadDocument() API with signal.");
            const result = await uploadDocument(files, controller.signal);
            console.log("[LOG] Dashboard: Upload successful.");
            setToast({ message: `Upload successful. ${result.data.documentIds.length} document(s) processed.`, type: 'success' });
            fetchDocuments();
        } catch (error) {
            console.error("[LOG] Dashboard: Upload encountered an error:", error);
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                 console.log("[LOG] Dashboard: Upload request was successfully aborted by user.");
                 setToast({ message: "Upload stopped.", type: 'warning' });
            } else if (error.response && error.response.status === 409) {
                console.warn("[LOG] Dashboard: Duplicate file upload detected.");
                setToast({ message: error.response.data.error, type: 'error' });
            } else {
                console.error("[LOG] Dashboard: Generic upload failure.");
                setToast({ message: `Upload failed. Please try again.`, type: 'error' });
            }
        } finally {
            console.log("[LOG] Dashboard: Upload finalized. Cleaning up controller and state.");
            setIsUploading(false);
            uploadAbortControllerRef.current = null;
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
                console.log("[LOG] Dashboard: File input cleared.");
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
        console.log(`[LOG] Dashboard: handleOpenDocument triggered for docId: ${documentId}, name: ${documentName}`);
        setIsPdfLoading(true);
        setPdfUrl(null);
        setCurrentHighlight(null);
        try {
            console.log(`[LOG] Dashboard: Calling getDocument(${documentId})`);
            const pdfBlob = await getDocument(documentId);
            const url = URL.createObjectURL(pdfBlob);
            console.log(`[LOG] Dashboard: PDF Blob URL created. Setting PDF URL.`);
            setPdfUrl(url);
        } catch (error) {
            console.error("Failed to load document:", error);
            setToast({ message: 'Could not load the document.', type: 'error' });
        } finally {
            console.log(`[LOG] Dashboard: Setting isPdfLoading to false.`);
            setIsPdfLoading(false);
        }
    };

    const handleCopyToClipboard = (text) => {
        console.log(`[LOG] Dashboard: Attempting to copy text: "${text}"`);
        if (!navigator.clipboard) {
            console.error('[LOG] Dashboard: Clipboard API not available.');
            setToast({ message: 'Clipboard API is not available in your browser.', type: 'error' });
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            console.log(`[LOG] Dashboard: Successfully copied to clipboard.`);
            const toastMessage = `Copied "${text.length > 20 ? text.substring(0, 20) + '...' : text}" to clipboard!`;
            setToast({ message: toastMessage, type: 'success' });
        }, (err) => {
            console.error('[LOG] Dashboard: Failed to copy text: ', err);
            setToast({ message: 'Failed to copy text.', type: 'error' });
        });
    };

    const handleNewChat = async () => {
        console.log("[LOG] Dashboard: handleNewChat triggered.");
        const hasUserMessages = messages.some(m => m.sender === 'user');

        // Only prevent creating new chat if the *current* active chat has no user messages.
        // If activeConversationId is null, it means we are in the initial state, allow creating one.
        if (!hasUserMessages && activeConversationId !== null) {
            console.log("[LOG] Dashboard: No user messages in current chat. No new chat created.");
            return;
        }

        console.log("[LOG] Dashboard: Creating new conversation via API...");
        try {
            const response = await createNewConversation();
            const newConversation = response.data;
            console.log("[LOG] Dashboard: Successfully created new conversation. ID:", newConversation.conversation_id);
            setActiveConversationId(newConversation.conversation_id);
            setMessages(getInitialMessages());
            fetchConversations(); // Refresh list
            setToast({ message: 'New chat created!', type: 'success' });
        } catch (error) {
            console.error("[LOG] Dashboard: Failed to create new conversation:", error);
            setToast({ message: 'Could not create a new chat. Please try again.', type: 'error' });
        }
    };

    // --- NEW FUNCTION START: Handle selecting a conversation ---
    const handleSelectConversation = async (selectedId) => {
        console.log(`[LOG] Dashboard: handleSelectConversation triggered for ID: ${selectedId}`);

        if (selectedId === activeConversationId) {
            console.log("[LOG] Dashboard: Selected conversation is already active. No action needed.");
            return; // Avoid unnecessary re-fetch
        }

        // Immediately update the active ID
        setActiveConversationId(selectedId);
        // Show loading state
        setMessages([{ sender: 'system', text: 'Loading chat history...' }]);

        try {
            console.log(`[LOG] Dashboard: Calling getConversationHistory(${selectedId})...`);
            const response = await getConversationHistory(selectedId);
            const history = response.data;
            console.log(`[LOG] Dashboard: Successfully fetched history with ${history.length} messages.`);

            // If history is empty (e.g., a newly created chat that wasn't used), show welcome.
            // Otherwise, show the fetched history.
            setMessages(history.length > 0 ? history : getInitialMessages());

        } catch (error) {
            console.error(`[LOG] Dashboard: Failed to fetch history for conversation ${selectedId}:`, error);
            setToast({ message: 'Could not load the selected chat history.', type: 'error' });
            // Fallback to the initial welcome message on error
            setMessages(getInitialMessages());
             // Optionally reset activeConversationId if loading fails catastrophically?
            // setActiveConversationId(null);
        }
    };
    // --- NEW FUNCTION END ---


    return (
        <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">

            {isUploading && <ProcessingAnimation onStopUpload={handleStopUpload} />}

            {/* --- MODIFIED: Pass conversations list AND selection handler to Sidebar --- */}
            <Sidebar
                handleNewChat={handleNewChat}
                conversations={conversations}
                onSelectConversation={handleSelectConversation} // <-- Pass the handler
            />

            <div className="flex flex-col flex-grow relative">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                <header className="absolute top-0 right-0 p-4 z-10 flex items-center gap-4">
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
                    <ThemeToggleButton />
                </header>
                <div className="flex-grow overflow-y-auto pt-20 pb-40 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto space-y-8">

                        {messages.map((msg, index) => {
                             // --- MODIFIED: Added check for 'system' message type during history load ---
                            if (msg.sender === 'system') {
                                return (
                                    <motion.div
                                        key={index} // Use index as key for system messages too
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex justify-center items-center my-2"
                                    >
                                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                            {msg.text} {/* Display loading/error text */}
                                        </span>
                                    </motion.div>
                                );
                            }

                            const showLargeSpace = index > 0 && messages[index - 1].sender !== msg.sender;

                            return (
                                <motion.div
                                    key={index} // Consider using msg.message_id if available and unique
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
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:px-8 from-white dark:from-gray-900 to-transparent bg-gradient-to-t">
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSearch} className="flex items-center p-2 bg-white dark:bg-gray-800/70 dark:backdrop-blur-lg rounded-full shadow-2xl border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full"> <FiPaperclip size={22} /> </button>
                            <input id="file-upload" ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf" />
                            <input ref={mainInputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask VAULT" disabled={isSearching} className="flex-grow px-4 py-2 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none" />
                            {isSearching ? (
                                <button type="button" onClick={handleStopGeneration} className="p-3 rounded-full text-gray-200 bg-gray-700 hover:bg-gray-600 transition-all duration-200 active:scale-90" title="Stop Generation"> <FiSquare size={22} /> </button>
                            ) : (
                                <button type="submit" disabled={!input.trim()} className="p-3 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-gray-600 transition-all duration-200 active:scale-90" title="Send Message"> <FiSend size={22} /> </button>
                            )}
                        </form>
                    </div>
                </div>
            </div>
            {(isPdfLoading || pdfUrl) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    {isPdfLoading ? (
                        <div className="text-white text-lg">Loading secure document...</div>
                    ) : (
                        <PdfViewer fileUrl={pdfUrl} onClose={closePdfViewer} highlight={currentHighlight} />
                    )}
                </div>
            )}
        </div>
    );
}

export default Dashboard;