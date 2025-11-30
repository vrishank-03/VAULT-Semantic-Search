// frontend/src/pages/ChatRoomPage/hooks/useConversations.js
// --------------------------------------------------------
// [UX FIX] Added internal 'TypingTitle' component for sidebar animations
// [UX] Titles animate "word by word" style on update
// --------------------------------------------------------

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getConversations, createNewConversation, getConversationHistory } from '../../../services/api';
import { useLayout } from '../../../context/LayoutContext';
import { FiArrowLeft, FiPlus, FiMessageSquare, FiClock } from 'react-icons/fi';
import { getInitialMessages } from '../utils/messageUtils';
import { toast } from 'react-hot-toast';

// --- INTERNAL COMPONENT: TypingTitle ---
// Defined here because it's used inside the effect payload
const TypingTitle = ({ text }) => {
    const [display, setDisplay] = useState(text);
    const hasMounted = useRef(false);

    useEffect(() => {
        // On mount, just show it (handle refresh)
        if (!hasMounted.current) {
            setDisplay(text);
            hasMounted.current = true;
            return;
        }

        // If text hasn't changed, ignore
        if (text === display) return;

        // If text CHANGED (New Chat -> Actual Title), type it
        let i = 0;
        const target = text;
        setDisplay("");

        const interval = setInterval(() => {
            setDisplay(target.substring(0, i + 1));
            i++;
            if (i === target.length) clearInterval(interval);
        }, 30); // 30ms smooth typing

        return () => clearInterval(interval);
    }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

    return <span className="truncate font-medium">{display}</span>;
};


export const useConversations = (
    roomId,
    roomName,
    isAccessGranted,
    isSearchingRef,
    setMessages,
    activeConversationId,
    setActiveConversationId
) => {
    const [conversations, setConversations] = useState([]);
    const { setSidebarContent } = useLayout();

    // --- HELPER: Load History ---
    const loadConversationHistory = useCallback(async (id) => {
        if (!isSearchingRef.current) {
            setMessages([{ sender: 'ai', text: 'Loading history...', isLoading: true, status: 'Restoring...' }]);
        }

        try {
            const response = await getConversationHistory(id);
            const history = response.data || [];

            if (history.length === 0) {
                if (isSearchingRef.current) return;
                setMessages(getInitialMessages(roomName));
                return;
            }

            const parsedHistory = history.map(msg => ({
                sender: (msg.sender || msg.role || 'ai').toLowerCase() === 'user' ? 'user' : 'ai',
                text: msg.message || msg.content || msg.text || "",
                sources: msg.metadata?.sources || [],
                results: msg.metadata ? { metadata: msg.metadata } : null,
                isLoading: false,
                status: null
            })).filter(m => m.text && m.text.trim() !== "");

            setMessages(parsedHistory.length > 0 ? parsedHistory : getInitialMessages(roomName));

        } catch (error) {
            console.error(`[useConversations] History Load Error:`, error);
            if (!isSearchingRef.current) setMessages(getInitialMessages(roomName));
        }
    }, [setMessages, roomName, isSearchingRef]);


    // --- 1. Fetch Conversations List ---
    const fetchConversations = useCallback(async (restoreHistory = true) => {
        if (!roomId || !isAccessGranted) return;

        try {
            const response = await getConversations(roomId);
            const convos = (response.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setConversations(convos);

            if (convos.length > 0 && !activeConversationId) {
                const mostRecent = convos[0];
                setActiveConversationId(mostRecent.conversation_id);
                if (restoreHistory) loadConversationHistory(mostRecent.conversation_id);
            }
            else if (convos.length === 0 && !activeConversationId) {
                handleNewChat();
            }
        } catch (error) {
            console.error("[useConversations] List Fetch Error:", error);
        }
    }, [roomId, isAccessGranted, activeConversationId, setActiveConversationId, loadConversationHistory, roomName]); // Removed handleNewChat dependency


    // --- 2. Create New Chat ---
    const handleNewChat = useCallback(async () => {
        if (!roomId) return;

        const existingEmpty = conversations.find(c =>
            c.title === "New Chat" || c.title === "Untitled Chat"
        );

        if (existingEmpty) {
            setActiveConversationId(existingEmpty.conversation_id);
            setMessages(getInitialMessages(roomName));
            return;
        }

        try {
            const response = await createNewConversation(roomId);
            const newConversation = response.data;
            setConversations(prev => [newConversation, ...prev]);
            setActiveConversationId(newConversation.conversation_id);
            setMessages(getInitialMessages(roomName));
            toast.success("New chat started");
        } catch (error) {
            console.error("[useConversations] Creation Error:", error);
            toast.error("Could not create new chat.");
        }
    }, [roomId, roomName, setMessages, setActiveConversationId, conversations]);


    // --- 3. Select Handler ---
    const handleSelectConversation = useCallback((selectedId) => {
        if (selectedId === activeConversationId || isSearchingRef.current) return;
        setActiveConversationId(selectedId);
        loadConversationHistory(selectedId);
    }, [activeConversationId, isSearchingRef, setActiveConversationId, loadConversationHistory]);


    // --- 4. Sidebar Effect ---
    useEffect(() => {
        if (isAccessGranted) {
            setSidebarContent(
                <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-[#111] border-r border-zinc-200 dark:border-zinc-800">
                    <div className="p-4 space-y-3">
                        <Link
                            to="/dashboard"
                            className="flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors mb-2"
                        >
                            <FiArrowLeft className="mr-1" /> Back to Dashboard
                        </Link>
                        <button
                            onClick={handleNewChat}
                            className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-md shadow-sm transition-all"
                        >
                            <FiPlus className="mr-2" /> New Chat
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
                        <div className="px-2 mb-2">
                            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">History</h3>
                        </div>
                        <div className="space-y-0.5">
                            {conversations.length > 0 ? (
                                conversations.map((convo) => {
                                    const isActive = convo.conversation_id === activeConversationId;
                                    return (
                                        <button
                                            key={convo.conversation_id}
                                            onClick={() => handleSelectConversation(convo.conversation_id)}
                                            className={`
                                                group flex items-center w-full px-3 py-2.5 text-sm text-left rounded-md transition-all duration-200
                                                ${isActive
                                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700'
                                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                                }
                                            `}
                                        >
                                            <FiMessageSquare className={`mr-3 flex-shrink-0 transition-colors ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-600'}`} size={16} />
                                            <div className="flex-1 min-w-0">
                                                {/* [FIX] Use TypingTitle here */}
                                                <TypingTitle text={convo.title || "New Chat"} />
                                                <p className="text-[10px] text-zinc-400 truncate">{new Date(convo.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <FiClock className="mx-auto text-zinc-300 mb-2" size={24} />
                                    <p className="text-xs text-zinc-400">No history yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        return () => setSidebarContent(null);
    }, [setSidebarContent, isAccessGranted, roomName, conversations, activeConversationId, handleNewChat, handleSelectConversation]);

    return { fetchConversations };
};