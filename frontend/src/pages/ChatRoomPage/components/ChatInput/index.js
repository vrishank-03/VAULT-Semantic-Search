// frontend/src/pages/ChatRoomPage/components/ChatInput/index.js (Corrected)

import React, { useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { FiPaperclip, FiSend, FiSquare } from 'react-icons/fi';
import ModelSelector from '../ModelSelector';

/**
 * Renders the main chat input bar, including model selection and file upload.
 * This is a "controlled component". The main input state is held by the parent.
 */
const ChatInput = ({
    input,
    setInput,
    isSearching,
    isUploading,
    handleSearch,
    handleStopGeneration,
    handleFileUpload,
    fileInputRef,
    mainInputRef
}) => {
    const { user } = useAuth();

    // Model selection state is local to the input bar
    const [modelName, setModelName] = useState('auto');
    const [isDeepThink, setIsDeepThink] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        handleSearch(input, modelName, isDeepThink); // Pass local state up
        setInput(''); // Clear local state
        setShowModelSelector(false);
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:px-8 from-white dark:from-gray-900 to-transparent bg-gradient-to-t">
            <div className="max-w-4xl mx-auto relative">
                
                <ModelSelector 
                    modelName={modelName}
                    setModelName={setModelName}
                    isDeepThink={isDeepThink}
                    setIsDeepThink={setIsDeepThink}
                    showModelSelector={showModelSelector}
                    setShowModelSelector={setShowModelSelector}
                />

                <form onSubmit={handleSubmit} className="flex items-center p-2 bg-white dark:bg-gray-800/70 dark:backdrop-blur-lg rounded-full shadow-2xl border border-gray-200 dark:border-gray-700">
                    
                    {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
                        <>
                            <button type="button" onClick={() => fileInputRef.current.click()} disabled={isUploading || isSearching} className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full disabled:opacity-50"> <FiPaperclip size={22} /> </button>
                            <input id="file-upload" ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf" />
                        </>
                    )}
                    <input 
                        ref={mainInputRef} 
                        type="text" 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        placeholder="Ask VAULT about documents or system logs..." 
                        disabled={isSearching} 
                        className="flex-grow px-4 py-2 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none" 
                    />
                    {isSearching ? (
                        <button type="button" onClick={handleStopGeneration} className="p-3 rounded-full text-gray-200 bg-gray-700 hover:bg-gray-600 transition-all duration-200 active:scale-90" title="Stop Generation"> <FiSquare size={22} /> </button>
                    ) : (
                        <button type="submit" disabled={!input.trim()} className="p-3 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-gray-600 transition-all duration-200 active:scale-90" title="Send Message"> <FiSend size={22} /> </button>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ChatInput;