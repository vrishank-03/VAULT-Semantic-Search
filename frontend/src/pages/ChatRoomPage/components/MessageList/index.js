// frontend/src/pages/ChatRoomPage/components/MessageList/index.js

import React, { useRef, useEffect } from 'react';
import MessageBubble from '../MessageBubble';

/**
 * Renders the scrolling list of messages.
 */
const MessageList = ({
    messages,
    isSearching,
    handleEditMessage,
    handleCopyToClipboard,
    handleSourceClick
}) => {
    const messagesEndRef = useRef(null);
    const lastMessageText = messages[messages.length - 1]?.text;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, lastMessageText]); // Scroll on new message or text chunk

    return (
        <div className="flex-grow overflow-y-auto pb-40 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
            <div className="h-12" /> {/* Spacer for header */}
            <div className="max-w-4xl mx-auto space-y-8">
                {messages.map((msg, index) => (
                    <MessageBubble
                        key={index}
                        msg={{
                            ...msg,
                            // Calculate if space is needed before rendering
                            showLargeSpace: index > 0 && messages[index - 1].sender !== msg.sender
                        }}
                        index={index}
                        isSearching={isSearching}
                        handleEditMessage={handleEditMessage}
                        handleCopyToClipboard={handleCopyToClipboard}
                        handleSourceClick={handleSourceClick}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default MessageList;