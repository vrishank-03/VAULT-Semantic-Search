// frontend/src/pages/ChatRoomPage/hooks/useChatStream.js (Corrected)

import { useEffect, useRef } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { postChatQuery, createNewConversation } from '../../../services/api';
import { CHAT_RESPONSE_EVENT, STREAM_EVENTS, STOP_GENERATION_EVENT } from '../utils/socketEvents';

/**
 * Hook to manage the entire chat streaming and message state.
 * State is "lifted" to the parent component.
 */
export const useChatStream = (
    roomId, 
    activeConversationId, 
    setActiveConversationId, 
    fetchConversations, 
    setToast,
    setInput,
    setMessages,
    setIsSearching
) => {
    const { socket, isConnected, socketId } = useSocket();
    const mainInputRef = useRef(null); // Ref is still owned by this hook

    // Socket listener effect
    useEffect(() => {
        // [FIX] Added a stronger guard:
        // We must check that 'socket' exists AND that it has the '.on' method.
        // This prevents the race condition crash.
        if (!socket || !socket.on || !isConnected || !activeConversationId) {
            return;
        }
        
        const eventName = `${CHAT_RESPONSE_EVENT}_${activeConversationId}`;
        console.log(`[useChatStream] Registering listener for: ${eventName}`);
        
        const handleSocketEvent = (event) => {
             switch (event.type) {
                case STREAM_EVENTS.STATUS:
                case STREAM_EVENTS.CLASSIFICATION:
                    setMessages(prev => prev.map((msg, index) => (index === prev.length - 1 && msg.isLoading) ? { ...msg, status: event.data.message || event.data.queryType } : msg));
                    break;
                case STREAM_EVENTS.CHUNK:
                    setMessages(prev => prev.map((msg, index) => (index === prev.length - 1 && msg.isLoading) ? { ...msg, text: msg.text + event.data, status: 'Generating answer...' } : msg));
                    break;
                case STREAM_EVENTS.FINAL:
                    setMessages(prev => [...prev.slice(0, -1), { sender: 'ai', text: event.data.answer, results: event.data, isLoading: false, status: null }]);
                    setIsSearching(false);
                    break;
                case STREAM_EVENTS.ERROR:
                    setMessages(prev => [...prev.slice(0, -1), { sender: 'system', text: `Error: ${event.data.message}` }]);
                    setIsSearching(false);
                    break;
                default:
                    console.warn(`[useChatStream] Received unknown event type: ${event.type}`);
            }
        };
        
        socket.on(eventName, handleSocketEvent);
        
        // Cleanup
        return () => {
            console.log(`[useChatStream] Unregistering listener for: ${eventName}`);
            socket.off(eventName, handleSocketEvent);
        };
    }, [socket, isConnected, activeConversationId, setMessages, setIsSearching]); // Dependencies are correct

    const handleSearch = async (input, modelName, isDeepThink) => {
        if (!input.trim()) return; // isSearching check is now in parent
        if (!socket || !isConnected || !socketId) {
            setToast({ message: 'Not connected to server. Please refresh.', type: 'error' });
            return;
        }

        setIsSearching(true);
        const userMessage = { sender: 'user', text: input };
        const aiStreamingMessage = { sender: 'ai', text: '', isLoading: true, status: 'Initializing...', results: { sources: [] } };
        setMessages(prev => [...prev, userMessage, aiStreamingMessage]);

        let convoId = activeConversationId;

        try {
            if (!convoId) {
                setMessages(prev => prev.map(m => m.isLoading ? { ...m, status: 'Creating new chat...' } : m));
                const response = await createNewConversation(roomId);
                convoId = response.data.conversation_id;
                setActiveConversationId(convoId);
                fetchConversations();
            }
            
            await postChatQuery(input, convoId, roomId, socketId, modelName, isDeepThink);
        } catch (error) {
            const errorText = error.response?.data?.message || 'Failed to send message.';
            setToast({ message: errorText, type: 'error' });
            setMessages(prev => [...prev.slice(0, -1), { sender: 'system', text: `Error: ${errorText}` }]);
            setIsSearching(false);
        }
    };

    const handleStopGeneration = () => {
        if (socket && activeConversationId) {
            socket.emit(STOP_GENERATION_EVENT, { conversationId: activeConversationId });
        }
        setMessages(prev => [...prev.slice(0, -1), { sender: 'system', text: 'Generation stopped by user.' }]);
        setIsSearching(false);
    };

    const handleEditMessage = (messageIndex) => {
        // Find the message to edit
        let messageToEditText = "";
        setMessages(prev => {
            const messageToEdit = prev[messageIndex];
            if (messageToEdit.sender !== 'user') return prev;
            messageToEditText = messageToEdit.text;
            return prev.slice(0, messageIndex); // Rewind history
        });
        
        setInput(messageToEditText); // Set parent's input state
    };

    // Return ONLY the handlers and refs
    return {
        mainInputRef,
        handleSearch,
        handleStopGeneration,
        handleEditMessage
    };
};