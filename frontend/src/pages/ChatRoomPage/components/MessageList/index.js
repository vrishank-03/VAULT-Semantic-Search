// frontend/src/pages/ChatRoomPage/components/MessageList/index.js
// --------------------------------------------------------
// [FIXED] Message List with Auto-scroll and Crash Guards
// --------------------------------------------------------
import React, { useEffect, useRef } from 'react';
import MessageBubble from '../MessageBubble';

const MessageList = ({
  messages,
  isSearching,
  handleEditMessage,
  handleCopyToClipboard,
  handleSourceClick
}) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages change or while searching
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSearching]);

  return (
    <div className="flex-1 overflow-y-auto w-full scroll-smooth px-4 py-8 md:px-8 lg:px-0">
      <div className="max-w-4xl mx-auto space-y-8">

        {messages.map((msg, index) => {
          // [CRITICAL] Safety check: Ignore undefined/null messages in the array
          if (!msg) return null;

          return (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`w-full ${msg.sender === 'user' ? 'max-w-2xl' : 'max-w-full'}`}>
                <MessageBubble
                  message={msg}
                  isLast={index === messages.length - 1}
                  handleEditMessage={() => handleEditMessage(index)}
                  handleCopyToClipboard={handleCopyToClipboard}
                  handleSourceClick={handleSourceClick}
                  isSearching={isSearching}
                />
              </div>
            </div>
          );
        })}

        {/* Fallback Loading Indicator (Only if waiting for first chunk/AI response) */}
        {isSearching && messages.length > 0 && messages[messages.length - 1].sender !== 'ai' && (
          <div className="flex justify-start w-full">
            <span className="text-sm text-gray-400 animate-pulse ml-14">Thinking...</span>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default MessageList;