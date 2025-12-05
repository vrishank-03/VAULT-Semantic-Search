// frontend/src/pages/ChatRoomPage/hooks/useChatStream.js
// --------------------------------------------------------
// [CRITICAL FIX] Added "Double Tap" refresh to catch slow Title Generation
// [UX] Ensures "New Chat" updates to real name automatically
// --------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { postChatQuery } from '../../../services/api';

const CHAT_RESPONSE_EVENT = 'chat_response';
const STOP_GENERATION_EVENT = 'stop_generation';

const STREAM_EVENTS = {
    STATUS: 'status',
    CLASSIFICATION: 'classification',
    CHUNK: 'chunk',
    FINAL: 'final',
    ERROR: 'error',
    TITLE: 'title_generated'
};

const TICK_RATE_MS = 15;

export const useChatStream = (
    roomId,
    activeConversationId,
    setActiveConversationId,
    fetchConversations,
    setToast,
    setInput,
    setMessages,
    isSearchingRef
) => {
    const { socket, isConnected, socketId } = useSocket();

    // Streaming State
    const incomingQueue = useRef("");
    const streamActiveRef = useRef(false);
    const pendingMetadata = useRef(null);

    // --- 1. Lossless Queue Processor ---
    useEffect(() => {
        let typingInterval;

        const processQueue = () => {
            let chunkToAppend = "";
            let shouldMarkDone = false;

            if (incomingQueue.current.length > 0) {
                const charsToType = 2;
                chunkToAppend = incomingQueue.current.substring(0, charsToType);
                incomingQueue.current = incomingQueue.current.substring(charsToType);
            }
            else if (!streamActiveRef.current && isSearchingRef.current) {
                shouldMarkDone = true;
            }

            if (!chunkToAppend && !shouldMarkDone) return;

            setMessages(prev => {
                const lastIndex = prev.length - 1;
                const lastMsg = prev[lastIndex];

                if (!lastMsg || lastMsg.sender !== 'ai') return prev;

                const newMessages = [...prev];

                // CASE A: Append Text
                if (chunkToAppend) {
                    newMessages[lastIndex] = {
                        ...lastMsg,
                        text: lastMsg.text + chunkToAppend
                    };
                }

                // CASE B: Mark Complete & Trigger Title Sync
                if (shouldMarkDone && lastMsg.isLoading) {
                    isSearchingRef.current = false;

                    // 1. Immediate Refresh (Clear status, show history)
                    setTimeout(() => fetchConversations(false), 0);

                    // 2. [CRITICAL FIX] Delayed Refresh (Catch the slow Title Generator)
                    // Title generation usually takes 2-3 seconds after the answer.
                    setTimeout(() => {
                        console.log('[useChatStream] 🔄 Checking for Title Update...');
                        fetchConversations(false);
                    }, 4000);

                    newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        isLoading: false,
                        status: null,
                        results: pendingMetadata.current || lastMsg.results
                    };
                }

                return newMessages;
            });
        };

        typingInterval = setInterval(processQueue, TICK_RATE_MS);
        return () => clearInterval(typingInterval);
    }, [setMessages, fetchConversations, isSearchingRef]);


    // --- 2. Socket Listener ---
    useEffect(() => {
        if (!socket || !socket.on || !isConnected) return;

        const channelId = activeConversationId || 'null';
        const eventName = `${CHAT_RESPONSE_EVENT}_${channelId}`;

        console.log(`[useChatStream] 👂 Tuning into: ${eventName}`);

        const handleSocketEvent = (event) => {
            switch (event.type) {
                case STREAM_EVENTS.STATUS:
                case STREAM_EVENTS.CLASSIFICATION:
                    setMessages(prev => prev.map((msg, index) => {
                        if (index === prev.length - 1 && msg.isLoading) {
                            return { ...msg, status: event.data.message || event.data.queryType };
                        }
                        return msg;
                    }));
                    break;

                case STREAM_EVENTS.CHUNK:
                    streamActiveRef.current = true;
                    incomingQueue.current += event.data;
                    break;

                case STREAM_EVENTS.TITLE:
                    // If the backend is fast enough to send the event, catch it here
                    console.log('[useChatStream] 🏷️ Title Event Received');
                    fetchConversations(false);
                    break;

                case 'final':
                case 'complete':
                case STREAM_EVENTS.FINAL:
                    console.log('[useChatStream] ✅ Backend Stream Complete.');
                    streamActiveRef.current = false;
                    pendingMetadata.current = event.data;
                    break;

                case STREAM_EVENTS.ERROR:
                    streamActiveRef.current = false;
                    isSearchingRef.current = false;
                    incomingQueue.current = "";
                    setMessages(prev => [...prev.slice(0, -1), {
                        sender: 'system',
                        text: `Error: ${event.data.message || 'Stream error'}`
                    }]);
                    break;

                default: break;
            }
        };

        socket.on(eventName, handleSocketEvent);
        return () => socket.off(eventName, handleSocketEvent);
    }, [socket, isConnected, activeConversationId, setMessages, isSearchingRef, fetchConversations]);


    // --- 3. Handlers ---
    const handleSearch = async (input, chatMode) => {
        if (!input.trim()) return;
        if (!socket || !isConnected) {
            setToast({ message: 'Server disconnected.', type: 'error' });
            return;
        }

        isSearchingRef.current = true;
        streamActiveRef.current = true;
        incomingQueue.current = "";
        pendingMetadata.current = null;

        const userMsg = { sender: 'user', text: input };
        const aiMsg = { sender: 'ai', text: '', isLoading: true, status: 'Thinking...', results: { sources: [] } };

        setMessages(prev => [...prev, userMsg, aiMsg]);

        let convoId = activeConversationId;

        try {
            await postChatQuery(input, convoId, roomId, socketId, chatMode);
        } catch (error) {
            console.error(error);
            isSearchingRef.current = false;
            streamActiveRef.current = false;
            setMessages(prev => prev.slice(0, -1));
            setToast({ message: 'Failed to send message.', type: 'error' });
        }
    };

    const handleStopGeneration = () => {
        if (socket && activeConversationId) {
            socket.emit(STOP_GENERATION_EVENT, { conversationId: activeConversationId });
        }
        streamActiveRef.current = false;
        incomingQueue.current = "";
        isSearchingRef.current = false;
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (!lastMsg || !lastMsg.isLoading) return prev;
            return [...prev.slice(0, -1), { ...lastMsg, isLoading: false, status: 'Stopped' }];
        });
    };

    const handleEditMessage = (messageIndex) => {
        setMessages(prev => {
            const msg = prev[messageIndex];
            if (msg.sender === 'user') {
                setInput(msg.text);
                return prev.slice(0, messageIndex);
            }
            return prev;
        });
    };

    return { handleSearch, handleStopGeneration, handleEditMessage };
};