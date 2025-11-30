// frontend/src/pages/ChatRoomPage/components/ChatSearchModal.js

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSearch, FiMessageSquare } from 'react-icons/fi';
import { searchChatHistory } from '../../../services/api';
import LoadingSpinner from '../../../components/LoadingSpinner';

/**
 * Modal component for fuzzy searching chat history using pg_trgm.
 */
const ChatSearchModal = ({ isOpen, onClose, setToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSearch = async (e) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (term.length < 3) {
            setToast({ message: "Search term must be at least 3 characters.", type: 'warning' });
            return;
        }

        setIsLoading(true);
        try {
            const response = await searchChatHistory(term);
            setResults(response.data);
            if (response.data.length === 0) {
                setToast({ message: "No matching conversations found.", type: 'info' });
            }
        } catch (error) {
            console.error("Chat search failed:", error);
            setToast({ message: "Error performing chat search.", type: 'error' });
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to highlight the search term in the message text
    const highlightText = (text, term) => {
        if (!term) return <p>{text}</p>;
        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return (
            <p className="line-clamp-2">
                {parts.map((part, i) => (
                    <span key={i} className={part.toLowerCase() === term.toLowerCase() ? "bg-yellow-300 dark:bg-yellow-600 font-bold" : ""}>
                        {part}
                    </span>
                ))}
            </p>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl dark:bg-gray-800"
            >
                {/* Header and Search Input */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        <FiSearch className="mr-2" /> Search Conversations
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">
                        <FiX size={24} />
                    </button>
                </div>

                <form onSubmit={handleSearch} className="p-4 flex flex-shrink-0">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search for keywords, phrases, or partial words..."
                        className="flex-grow p-3 border border-gray-300 dark:border-gray-700 rounded-l-lg dark:bg-gray-700 dark:text-white focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || searchTerm.length < 3}
                        className="px-6 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 flex items-center"
                    >
                        {isLoading ? <LoadingSpinner size={18} /> : <FiSearch size={20} />}
                    </button>
                </form>

                {/* Search Results Area */}
                <div className="flex-grow p-5 overflow-y-auto space-y-4">
                    {results.map((convo) => (
                        <div key={convo.conversation_id} className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                            
                            {/* Conversation Header */}
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-t-lg flex items-center justify-between">
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                                    <FiMessageSquare className="mr-2" /> {convo.conversation_title}
                                </span>
                            </div>

                            {/* Message Matches */}
                            <div className="p-3 space-y-3">
                                {convo.matches.map((match, i) => (
                                    <div key={i} className="text-xs text-gray-700 dark:text-gray-300 border-l-4 border-gray-400 dark:border-gray-600 pl-3">
                                        <p className="font-medium mb-1">
                                            {match.sender === 'user' ? 'You Asked' : 'VAULT Answered'} 
                                            <span className="ml-2 text-gray-500 dark:text-gray-400">
                                                (Score: {match.score.toFixed(2)})
                                            </span>
                                        </p>
                                        {highlightText(match.text, searchTerm)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Initial State / No Results */}
                    {!isLoading && results.length === 0 && (
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
                            Enter a search term above to find matching chat messages across all your conversations.
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ChatSearchModal;