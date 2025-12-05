// frontend/src/pages/ChatRoomPage/components/MessageBubble/index.js
// --------------------------------------------------------
// [STYLE] Enterprise "MNC" Aesthetic
// - Geometry: Rounded-lg (Sharp) instead of Rounded-2xl (Bubbly)
// - Palette: High-contrast Dark Slate for User, Clean White for AI
// - Layout: Structured headers and refined typography
// --------------------------------------------------------

import React from 'react';
import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm'; // Removed to fix build error
import { User, Copy, ThumbsUp, ThumbsDown, Edit2, Bot } from 'lucide-react';
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

  // --- USER MESSAGE (Enterprise Design) ---
  if (isUser) {
    return (
      <div className="flex justify-end gap-4 group mb-6">
        {/* Action Buttons (Left of message for User, hidden until hover) */}
        {!isSearching && (
          <div className="flex items-center self-start mt-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
            <button onClick={() => handleEditMessage()} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors" title="Edit">
              <Edit2 size={14} />
            </button>
            <button onClick={() => handleCopyToClipboard(message.text)} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors" title="Copy">
              <Copy size={14} />
            </button>
          </div>
        )}

        {/* The "Bubble" - Professional Dark Slate Block */}
        <div className="max-w-[80%]">
          <div className="bg-zinc-800 dark:bg-zinc-700 text-white px-5 py-3.5 rounded-lg shadow-sm border border-zinc-700/50">
            <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap">
              {message.text}
            </p>
          </div>
        </div>

        {/* Avatar - Squircle shape for Enterprise feel */}
        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center border border-zinc-300 dark:border-zinc-700">
            <User size={18} className="text-zinc-500 dark:text-zinc-400" />
          </div>
        </div>
      </div>
    );
  }

  // --- AI MESSAGE (Enterprise Design) ---

  // Custom Renderer for Citations within AI text
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
    <div className="flex gap-4 group mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 items-start">
      {/* AI Avatar */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-sm ring-1 ring-blue-700">
          <Bot size={20} strokeWidth={2.5} />
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">VAULT AI</span>
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Assistant</span>
        </div>

        {/* Thinking Process Animation */}
        {(isLoading || message.status) && (
          <div className="mb-4 ml-1">
            <ThinkingProcess currentStatus={message.status || (isLoading && !message.text ? 'Thinking...' : null)} />
          </div>
        )}

        {/* Markdown Content Block */}
        <div className="prose prose-slate dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-300 leading-7 text-[15px]">
          <ReactMarkdown
            components={{
              strong: ({ node, ...props }) => <strong className="font-semibold text-zinc-900 dark:text-white" {...props} />,
              p: ({ children }) => <p className="mb-4 last:mb-0"><CustomTextRenderer>{children}</CustomTextRenderer></p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="pl-1"><CustomTextRenderer>{children}</CustomTextRenderer></li>,
              a: ({ children, ...props }) => <a {...props} className="text-blue-600 hover:underline font-medium decoration-blue-300 underline-offset-2">{children}</a>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-blue-50 dark:bg-blue-900/20 italic rounded-r">{children}</blockquote>,
              code: ({ inline, children, ...props }) => inline ?
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-sm font-mono text-pink-600 dark:text-pink-400 border border-zinc-200 dark:border-zinc-700">{children}</code> :
                <div className="relative group my-6 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-500">Code Block</div>
                  <pre className="bg-zinc-50 dark:bg-[#0d1117] text-zinc-800 dark:text-zinc-100 p-4 overflow-x-auto m-0"><code className="font-mono text-sm" {...props}>{children}</code></pre>
                </div>,
              // Fallback table rendering
              table: ({ children }) => <div className="overflow-x-auto my-6 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm"><table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">{children}</table></div>,
              thead: ({ children }) => <thead className="bg-zinc-50 dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-200">{children}</thead>,
              th: ({ children }) => <th className="px-4 py-3 text-left font-semibold">{children}</th>,
              td: ({ children }) => <td className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">{children}</td>,
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Footer / Actions */}
        {!isLoading && (
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-transparent group-hover:border-zinc-100 dark:group-hover:border-zinc-800 transition-colors">
            <button onClick={() => handleCopyToClipboard(message.text)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs transition-colors">
              <Copy size={13} /> Copy
            </button>
            <div className="flex-1"></div>
            <button className="p-1.5 text-zinc-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"><ThumbsUp size={14} /></button>
            <button className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><ThumbsDown size={14} /></button>
          </div>
        )}

        {/* Sources Footer */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Citations & Sources</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((src, idx) => (
                <div key={idx} onClick={() => handleSourceClick(src)} className="group flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-md px-2.5 py-1.5 cursor-pointer transition-all shadow-sm">
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[180px] group-hover:text-blue-600 dark:group-hover:text-blue-400">{src.name}</span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-700">Pg {src.page}</span>
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