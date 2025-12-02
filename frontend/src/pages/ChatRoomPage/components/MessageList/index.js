// frontend/src/pages/ChatRoomPage/components/MessageList/index.js
// --------------------------------------------------------
// [FIXED] Smart Auto-scroll: Only scrolls if user is at the bottom
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
  const containerRef = useRef(null); // [NEW] Ref to track scroll position
  const prevMessagesLengthRef = useRef(messages.length); // [NEW] Track message count

  // Smart Auto-scroll Logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Detect if a completely new message was added (vs just streaming text update)
    const isNewMessage = messages.length > prevMessagesLengthRef.current;

    // 2. Measure current distance from bottom
    const { scrollHeight, scrollTop, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // 3. Define "At Bottom" threshold (e.g., within 150px)
    // If text is streaming, distanceFromBottom grows as content adds.
    // If the user was at the bottom, this value will be small (just the height of new text).
    // If they scrolled up, this value will be large.
    const isAtBottom = distanceFromBottom < 150;

    // 4. Scroll ONLY if it's a new message OR user is already "sticking" to bottom
    if (isNewMessage || isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    // Update ref for next render
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isSearching]);

  return (
    // [CRITICAL] Added ref={containerRef} to measure scrolling
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto w-full scroll-smooth px-4 py-8 md:px-8 lg:px-0"
    >
      <div className="max-w-4xl mx-auto space-y-8">

        {messages.map((msg, index) => {
          // [CRITICAL] Safety check: Ignore undefined/null messages
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