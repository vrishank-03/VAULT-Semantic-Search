// frontend/src/pages/ChatRoomPage/hooks/useConversations.js (Refactored)

import React, { useCallback, useEffect, useState } from 'react'; // Added useState
import { Link } from 'react-router-dom';
import { getConversations, createNewConversation, getConversationHistory } from '../../../services/api';
import { useLayout } from '../../../context/LayoutContext';
import { FiArrowLeft, FiPlus, FiMessageSquare } from 'react-icons/fi';
import { getInitialMessages } from '../utils/messageUtils';

/**
 * Hook to manage fetching, selecting, and creating new conversations.
 * State is "lifted" to the parent component.
 */
export const useConversations = (
    roomId, 
    roomName, 
    isAccessGranted, 
    isSearching, // Prop
    setMessages, // Prop
    activeConversationId, // Prop
    setActiveConversationId // Prop
) => {
    const [conversations, setConversations] = useState([]);
    const { setSidebarContent } = useLayout();

    const fetchConversations = useCallback(async () => {
        if (!roomId || !isAccessGranted) return;
        console.log(`[useConversations] Fetching conversations for room ${roomId}...`);
        try {
            const response = await getConversations(roomId); 
            setConversations(response.data);
        } catch (error) {
            console.error("[useConversations] Failed to fetch conversations:", error);
        }
    }, [roomId, isAccessGranted]);

    const handleNewChat = useCallback(async () => {
        console.log("[useConversations] handleNewChat triggered.");
        if (!roomId) return;

        try {
            const response = await createNewConversation(roomId);
            const newConversation = response.data;
            setActiveConversationId(newConversation.conversation_id);
            setMessages(getInitialMessages(roomName));
            fetchConversations(); // Refresh the list
        } catch (error) {
            console.error("[useConversations] Failed to create new conversation:", error);
            // Optionally set a toast in parent
        }
    }, [roomId, roomName, fetchConversations, setMessages, setActiveConversationId]);

    const handleSelectConversation = useCallback(async (selectedId) => {
        console.log(`[useConversations] handleSelectConversation triggered for ID: ${selectedId}`);

        if (selectedId === activeConversationId || isSearching) {
            return;
        }

        setActiveConversationId(selectedId);
        setMessages([{ sender: 'system', text: 'Loading chat history...' }]);

        try {
            const response = await getConversationHistory(roomId, selectedId);
            const history = response.data;
            const parsedHistory = history.map(msg => {
                if (msg.sender === 'ai' && msg.results) {
                    try {
                        return { ...msg, results: JSON.parse(msg.results) };
                    } catch (e) {
                        return { ...msg, results: null };
                    }
                }
                return msg;
            });

            setMessages(parsedHistory.length > 0 ? parsedHistory : getInitialMessages(roomName));
        } catch (error) {
            console.error(`[useConversations] Failed to fetch history for convo ${selectedId}:`, error);
            setMessages(getInitialMessages(roomName));
            setActiveConversationId(null); // Reset on failure
        }
    }, [activeConversationId, isSearching, roomId, roomName, setMessages, setActiveConversationId]);

    // Effect to update the main app layout sidebar
    useEffect(() => {
        if (isAccessGranted) {
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
                        {conversations.length > 0 ? (
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
        isAccessGranted, 
        roomName, 
        conversations, 
        activeConversationId, 
        handleNewChat, 
        handleSelectConversation
    ]);

    // Return ONLY the functions the parent needs
    return { fetchConversations };
};