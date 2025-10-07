import React, { useState, useEffect, useRef } from 'react';
import { uploadDocument, search, getDocument, getUserInfo, getDocuments } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PdfViewer from '../PdfViewer';
import ReactMarkdown from 'react-markdown';
import { FiPaperclip, FiSend, FiChevronDown, FiChevronUp } from 'react-icons/fi';
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
    
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [currentHighlight, setCurrentHighlight] = useState(null);

    const [toast, setToast] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    
    const { user } = useAuth();

    // NEW STATE for document list
    const [documents, setDocuments] = useState([]);
    const [showDocuments, setShowDocuments] = useState(false);

    // Function to fetch documents
    const fetchDocuments = async () => {
        try {
            const response = await getDocuments();
            setDocuments(response.data);
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            setToast({ message: 'Could not load your document list.', type: 'error' });
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Fetch documents on component mount
    useEffect(() => {
        fetchDocuments();
    }, []);


    const handleSearch = async (e) => {
        e.preventDefault();
        if (!input.trim() || isSearching) return;

        const userMessage = { sender: 'user', text: input };
        const currentHistory = [...messages, userMessage];
        setMessages([...currentHistory, { sender: 'ai', text: 'Thinking...', isLoading: true }]);
        setInput('');
        setIsSearching(true);

        try {
            const result = await search(input, currentHistory);
            const responseData = result.data;

            if (!responseData || typeof responseData.answer === 'undefined') {
                throw new Error("Invalid response structure from server.");
            }

            const aiResponse = { sender: 'ai', text: responseData.answer, results: responseData };
            setMessages(prev => [...prev.slice(0, -1), aiResponse]);

        } catch (error) {
            const errorText = error.response?.data?.message || 'Sorry, I encountered an error.';
            setToast({ message: errorText, type: 'error' });
            const errorResponse = { sender: 'ai', text: "My apologies, I seem to have encountered a problem. Please try your question again in sometime." };
            setMessages(prev => [...prev.slice(0, -1), errorResponse]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploading(true);
        setToast(null);
        
        try {
            const result = await uploadDocument(files);
            setToast({ message: `Upload successful. ${result.data.documentIds.length} document(s) processed.`, type: 'success' });
            fetchDocuments(); // Re-fetch documents to update the list
        } catch (error) {
            // UPDATED: Handle the new 409 Conflict error for duplicates
            if (error.response && error.response.status === 409) {
                setToast({ message: error.response.data.error, type: 'error' });
            } else {
                setToast({ message: `Upload failed. Please try again.`, type: 'error' });
            }
        } finally {
            setIsUploading(false);
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
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
            
            if (source.metadata && source.metadata.pageNumber) {
                const highlightData = { 
                    pageNumber: source.metadata.pageNumber,
                    textToHighlight: source.text
                };
                setCurrentHighlight(highlightData);
            } else {
                setCurrentHighlight(null);
            }

        } catch (error) {
            setToast({ message: 'Could not load the protected PDF.', type: 'error' });
        } finally {
            setIsPdfLoading(false);
        }
    };

    const closePdfViewer = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
        }
        setPdfUrl(null);
        setCurrentHighlight(null);
    };

    const handleNewChat = () => setMessages(getInitialMessages());

    return (
        <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
            {isUploading && <ProcessingAnimation />}
            <Sidebar handleNewChat={handleNewChat} />
            <div className="flex flex-col flex-grow relative">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                <header className="absolute top-0 right-0 p-4 z-10 flex items-center gap-4">
                    {/* NEW: "Show Documents" button and table */}
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
                                                <tr key={doc.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                                    <td className="px-4 py-3">{index + 1}</td>
                                                    <td className="px-4 py-3 font-medium truncate">{doc.name}</td>
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
                        {messages.map((msg, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.sender === 'ai' && (
                                    <img src={logo} alt="VAULT Logo" className="w-10 h-10" />
                                )}
                                
                                {msg.isLoading ? (
                                    <ThinkingAnimation />
                                ) : (
                                    <div className={`max-w-2xl px-6 py-4 rounded-3xl ${msg.sender === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-lg shadow-lg'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-lg shadow-lg'
                                        }`}>
                                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2">
                                            <ReactMarkdown>{msg.text || ""}</ReactMarkdown>
                                        </div>
                                        {msg.results && Array.isArray(msg.results.sources) && msg.results.sources.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-gray-200/20 dark:border-gray-700/50">
                                                <details>
                                                    <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline">
                                                        Show Sources ({msg.results.sources.length})
                                                    </summary>
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
                                        <img
                                            src={user.pictureUrl}
                                            alt="User Avatar"
                                            className="w-10 h-10 rounded-full flex-shrink-0 shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 shadow-lg flex items-center justify-center text-white font-semibold">
                                            {user && user.email ? user.email.charAt(0).toUpperCase() : '?'}
                                        </div>
                                    )
                                )}
                            </motion.div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:px-8 from-white dark:from-gray-900 to-transparent bg-gradient-to-t">
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSearch} className="flex items-center p-2 bg-white dark:bg-gray-800/70 dark:backdrop-blur-lg rounded-full shadow-2xl border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full">
                                <FiPaperclip size={22} />
                            </button>
                            <input id="file-upload" ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf" />
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question..."
                                disabled={isSearching}
                                className="flex-grow px-4 py-2 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
                            />
                            <button type="submit" disabled={isSearching || !input.trim()} className="p-3 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-gray-600 transition-transform duration-200 active:scale-90">
                                <FiSend size={22} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            {(isPdfLoading || pdfUrl) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    {isPdfLoading ? (
                        <div className="text-white text-lg">Loading secure document...</div>
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
}

export default Dashboard;