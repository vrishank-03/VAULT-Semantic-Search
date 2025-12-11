// frontend/src/pages/ChatRoomPage/components/MessageList/index.js
// --------------------------------------------------------
// [STYLE] Layout Fixes
// - Issue 3: Increased padding to prevent edge clipping ("Invisible boundary")
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
  const containerRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // [ATOMIC LOG] Scroll Logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    const { scrollHeight, scrollTop, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < 150;

    // Log for debugging scroll behavior
    // console.log(`[MessageList] Scroll Check - NewMsg: ${isNewMessage}, Dist: ${distanceFromBottom}, AtBottom: ${isAtBottom}`);

    if (isNewMessage || isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, isSearching]);

  return (
    <div
      ref={containerRef}
      // [ISSUE 3 FIX] Changed padding from px-4 to p-6/p-8 to give room for tooltips/shadows
      // Removed 'lg:px-0' which was forcing content to touch edges on large screens
      className="flex-1 overflow-y-auto w-full scroll-smooth p-6 md:p-8 custom-scrollbar"
    >
      <div className="max-w-4xl mx-auto space-y-10 pb-12"> {/* Added pb-12 for bottom breathing room */}

        {messages.map((msg, index) => {
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

        {isSearching && messages.length > 0 && messages[messages.length - 1].sender !== 'ai' && (
          // Refined Loading State
          <div className="flex justify-start w-full pl-2">
            <div className="flex items-center gap-3 opacity-60">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"></div>
              <span className="text-sm text-zinc-400 font-medium">Generating response...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
};

export default MessageList;