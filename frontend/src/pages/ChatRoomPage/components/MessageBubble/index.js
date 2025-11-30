// frontend/src/pages/ChatRoomPage/components/MessageBubble/index.js
// --------------------------------------------------------
// [CRITICAL FIX] Removed TextGenerateEffect to stop "Gibberish" scrambling
// [STYLE] Unified Markdown rendering for perfect formatting
// --------------------------------------------------------

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Copy, ThumbsUp, ThumbsDown, Edit2 } from 'lucide-react';
import CitationBadge from './CitationBadge';
import ThinkingProcess from '../../../../components/ThinkingProcess';

const MessageBubble = ({
  message,
  handleEditMessage,
  handleCopyToClipboard,
  handleSourceClick,
  isSearching
}) => {
  const isUser = message.sender === 'user';
  const isLoading = message.isLoading;

  // --- USER BUBBLE ---
  if (isUser) {
    return (
      <div className="flex justify-end gap-3 group">
        {!isSearching && (
          <div className="flex items-center self-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
            <button onClick={() => handleEditMessage()} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors" title="Edit">
              <Edit2 size={14} />
            </button>
            <button onClick={() => handleCopyToClipboard(message.text)} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors" title="Copy">
              <Copy size={14} />
            </button>
          </div>
        )}
        <div className="bg-[#f3f3f3] text-gray-800 px-6 py-3 rounded-2xl rounded-tr-sm max-w-full text-[15px] leading-relaxed shadow-sm">
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
        <div className="mt-1 min-w-[32px]">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <User size={16} />
          </div>
        </div>
      </div>
    );
  }

  // --- AI BUBBLE ---

  // Custom Renderer for Citations
  const CustomTextRenderer = ({ children }) => {
    if (typeof children !== 'string') return children;
    const citationRegex = /\[Source:\s*(.*?),\s*Page\s*(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(children)) !== null) {
      if (match.index > lastIndex) parts.push(children.substring(lastIndex, match.index));
      parts.push(
        <CitationBadge
          key={match.index}
          source={match[1]}
          page={match[2]}
          onClick={handleSourceClick}
        />
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < children.length) parts.push(children.substring(lastIndex));
    return <>{parts}</>;
  };

  return (
    <div className="flex gap-6 group animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
          <span className="font-bold text-xs">V</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-200">VAULT</span>
          <span className="text-xs text-zinc-400">Just now</span>
        </div>

        {/* Thinking Pulse */}
        {(isLoading || message.status) && (
          <div className="mb-4">
            <ThinkingProcess currentStatus={message.status || (isLoading && !message.text ? 'Thinking...' : null)} />
          </div>
        )}

        {/* Text Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none text-gray-800 dark:text-gray-300 leading-7">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              strong: ({ node, ...props }) => <strong className="font-bold text-zinc-900 dark:text-white" {...props} />,
              p: ({ children }) => <p className="mb-4"><CustomTextRenderer>{children}</CustomTextRenderer></p>,
              li: ({ children }) => <li className="pl-1"><CustomTextRenderer>{children}</CustomTextRenderer></li>,
              a: ({ children, ...props }) => <a {...props} className="text-blue-600 hover:underline font-medium">{children}</a>,
              code: ({ inline, children, ...props }) => inline ?
                <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-500">{children}</code> :
                <div className="relative group my-4"><pre className="bg-[#1e293b] text-gray-100 p-4 rounded-lg overflow-x-auto"><code className="font-mono text-sm" {...props}>{children}</code></pre></div>,
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Action Bar */}
        {!isLoading && (
          <div className="flex items-center gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button onClick={() => handleCopyToClipboard(message.text)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors" title="Copy"><Copy size={14} /></button>
            <button className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors" title="Good Answer"><ThumbsUp size={14} /></button>
            <button className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors" title="Bad Answer"><ThumbsDown size={14} /></button>
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Sources Used</p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((src, idx) => (
                <div key={idx} onClick={() => handleSourceClick(src)} className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 rounded-lg px-3 py-2 cursor-pointer transition-all">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[150px]">{src.name}</span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Pg {src.page}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;