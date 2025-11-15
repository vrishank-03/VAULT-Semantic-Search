// frontend/src/pages/ChatRoomPage/components/MessageBubble/index.js

import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { FiEdit2, FiCopy } from 'react-icons/fi';
import ThinkingAnimation from '../../../../components/ThinkingAnimation';
import logo from '../../../../assets/logo.png';
import { useAuth } from '../../../../context/AuthContext';

/**
 * Renders a single message bubble (user, AI, or system).
 */
const MessageBubble = ({
    msg,
    index,
    isSearching,
    handleEditMessage,
    handleCopyToClipboard,
    handleSourceClick
}) => {
    const { user } = useAuth();

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

    const showLargeSpace = msg.showLargeSpace; // This needs to be calculated in the parent
    
    return (
        <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            layout
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
                <ThinkingAnimation status={msg.status || 'Thinking...'} />
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
                                                [{source.number}] {source.name || `Doc ID ${source.id}`} {source.page && `(Page ${source.page})`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
                    
                    {msg.results && msg.results.metadata && (
                        <div className="mt-4 pt-3 border-t border-gray-200/20 dark:border-gray-700/50">
                            <details>
                                <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline">Show Raw Data</summary>
                                <pre className="mt-2 p-2 bg-gray-100/50 dark:bg-gray-700/40 rounded-lg text-xs overflow-x-auto">
                                    <code>{JSON.stringify(msg.results.metadata, null, 2)}</code>
                                </pre>
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
};

export default MessageBubble;