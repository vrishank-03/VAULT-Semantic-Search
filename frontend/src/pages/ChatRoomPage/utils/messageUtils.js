// frontend/src/pages/ChatRoomPage/utils/messageUtils.js

/**
 * Gets the initial welcome message for a chat room.
 * @param {string} roomName - The name of the room.
 * @returns {Array<object>} An array containing the initial message.
 */
export const getInitialMessages = (roomName = "this chat room") => {
    return [{ 
        sender: 'ai', 
        text: `Welcome to ${roomName}. I'm ready to answer questions about your documents or system logs.`,
        results: { sources: [] },
        isLoading: false,
    }];
};