// frontend/src/pages/ChatRoomPage/hooks/useChatStream.js
// --------------------------------------------------------
// [FIX] Sanitization: Clears "stuck" loading states on mount/refresh
// [NEW] Structured Thinking: Captures step-by-step logic for UI
// --------------------------------------------------------

import { useEffect, useRef } from 'react';
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

    // --- 0. SANITIZATION (Fixes "Stuck Thinking" on Refresh) ---
    useEffect(() => {
        // When the hook mounts (page load/refresh), check for any messages
        // that are stuck in 'isLoading: true' and kill them.
        setMessages(prev => prev.map(msg => {
            if (msg.isLoading) {
                console.warn('[useChatStream] Found stuck message. Forcing completion.');
                return { ...msg, isLoading: false, status: 'Interrupted' };
            }
            return msg;
        }));

        // Reset refs
        isSearchingRef.current = false;
        streamActiveRef.current = false;
    }, []); // Run once on mount

    // --- 1. Lossless Queue Processor ---
    useEffect(() => {
        let typingInterval;

        const processQueue = () => {
            let chunkToAppend = "";
            let shouldMarkDone = false;

            // Extract chars if available
            if (incomingQueue.current.length > 0) {
                const charsToType = 3; // Slightly faster typing for responsiveness
                chunkToAppend = incomingQueue.current.substring(0, charsToType);
                incomingQueue.current = incomingQueue.current.substring(charsToType);
            }
            // If queue is empty AND stream is dead AND we are still "searching"
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

                // CASE B: Mark Complete
                if (shouldMarkDone && lastMsg.isLoading) {
                    console.log('[useChatStream] Finalizing message.');
                    isSearchingRef.current = false;

                    // Sync Conversations
                    setTimeout(() => fetchConversations(false), 0);
                    // Double-check for title update later
                    setTimeout(() => fetchConversations(false), 4000);

                    newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        isLoading: false,
                        status: null, // Clear status text
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

        // console.log(`[useChatStream] 👂 Tuning into: ${eventName}`);

        const handleSocketEvent = (event) => {
            switch (event.type) {
                // --- STATUS & STEPS ---
                case STREAM_EVENTS.STATUS:
                case STREAM_EVENTS.CLASSIFICATION:
                    setMessages(prev => {
                        const lastIdx = prev.length - 1;
                        if (lastIdx < 0 || !prev[lastIdx].isLoading) return prev;

                        const msg = prev[lastIdx];
                        const stepText = event.data.message || event.data.queryType;

                        // Prevent duplicate steps
                        const lastStep = msg.thinkingSteps ? msg.thinkingSteps[msg.thinkingSteps.length - 1] : null;
                        if (lastStep && lastStep.text === stepText) return prev;

                        return [
                            ...prev.slice(0, lastIdx),
                            {
                                ...msg,
                                // Build a history of steps
                                thinkingSteps: [
                                    ...(msg.thinkingSteps || []),
                                    { text: stepText, timestamp: Date.now() }
                                ]
                            }
                        ];
                    });
                    break;

                // --- CONTENT ---
                case STREAM_EVENTS.CHUNK:
                    streamActiveRef.current = true;
                    incomingQueue.current += event.data;
                    break;

                // --- COMPLETION ---
                case STREAM_EVENTS.TITLE:
                    fetchConversations(false);
                    break;

                case 'final':
                case 'complete':
                case STREAM_EVENTS.FINAL:
                    // console.log('[useChatStream] ✅ Backend Stream Complete.');
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
        // Initialize with empty steps array
        const aiMsg = {
            sender: 'ai',
            text: '',
            isLoading: true,
            thinkingSteps: [{ text: 'Initializing...', timestamp: Date.now() }],
            results: { sources: [] }
        };

        setMessages(prev => [...prev, userMsg, aiMsg]);

        try {
            await postChatQuery(input, activeConversationId, roomId, socketId, chatMode);
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
            return [...prev.slice(0, -1), { ...lastMsg, isLoading: false, thinkingSteps: [...(lastMsg.thinkingSteps || []), { text: 'Stopped by user', timestamp: Date.now() }] }];
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