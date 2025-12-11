// frontend/src/pages/ChatRoomPage/components/MessageBubble/index.js
// --------------------------------------------------------
// [UPDATE] Connected 'thinkingSteps' prop to ThinkingProcess
// [MAINTAINED] All previous fixes (Tooltip, Timestamp, PDF Delegate)
// --------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Copy, ThumbsUp, ThumbsDown, Edit2, Bot, ExternalLink, FileText } from 'lucide-react';
import ThinkingProcess from '../../../../components/ThinkingProcess';
import logoSrc from '../../../../assets/logo.png';

// --- DYNAMIC TIMESTAMP ---
const DynamicTimestamp = ({ timestamp }) => {
  const [timeLabel, setTimeLabel] = useState('Just now');

  useEffect(() => {
    const messageTime = timestamp ? new Date(timestamp) : new Date();

    const updateTime = () => {
      const now = new Date();
      const diffInSeconds = Math.floor((now - messageTime) / 1000);

      if (diffInSeconds < 60) {
        setTimeLabel('Just now');
      } else {
        setTimeLabel(messageTime.toLocaleTimeString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 tracking-wide">
      {timeLabel}
    </span>
  );
};

// --- SLEEK CITATION (With Hover Grace Period) ---
const SleekCitation = ({ source, page, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  };

  const handleBadgeClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick({ name: source, page });
  };

  return (
    <span
      className="relative inline-block align-middle ml-1 mr-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleBadgeClick}
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
          transition-all duration-200 border cursor-pointer
          ${isHovered
            ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700'
            : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}
        `}
      >
        <FileText size={9} />
        SRC
      </button>

      {isHovered && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 z-50 animate-in fade-in zoom-in-95 duration-200"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2">
                {source}
              </span>
              <ExternalLink size={12} className="text-zinc-400 flex-shrink-0 mt-0.5" />
            </div>
            <div
              className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-1 cursor-pointer group"
              onClick={handleBadgeClick}
            >
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Page {page}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                Click to open PDF
              </span>
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 rotate-45 bg-white dark:bg-zinc-900 border-r border-b border-zinc-200 dark:border-zinc-700"></div>
        </div>
      )}
    </span>
  );
};

const MessageBubble = ({
  message,
  handleEditMessage,
  handleCopyToClipboard,
  handleSourceClick,
  isSearching
}) => {
  const isUser = message.sender === 'user';
  const isLoading = message.isLoading;
  const [logoError, setLogoError] = useState(false);

  // --- USER MESSAGE ---
  if (isUser) {
    return (
      <div className="flex justify-end gap-4 group mb-6 pl-10">
        <div className="flex items-center self-start mt-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
          <button onClick={() => handleEditMessage()} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={() => handleCopyToClipboard(message.text)} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors" title="Copy">
            <Copy size={14} />
          </button>
        </div>

        <div className="max-w-[85%]">
          <div className="bg-zinc-800 dark:bg-zinc-700 text-white px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-md border border-zinc-700/50">
            <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap">
              {message.text}
            </p>
          </div>
          <div className="flex justify-end mt-1 mr-1">
            <DynamicTimestamp timestamp={message.timestamp} />
          </div>
        </div>

        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 overflow-hidden">
            <User size={18} className="text-zinc-500 dark:text-zinc-400" />
          </div>
        </div>
      </div>
    );
  }

  // --- AI MESSAGE ---
  const CustomTextRenderer = ({ children }) => {
    if (typeof children !== 'string') return children;
    const citationRegex = /\[Source:\s*(.*?),\s*Page\s*(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(children)) !== null) {
      if (match.index > lastIndex) parts.push(children.substring(lastIndex, match.index));
      parts.push(
        <SleekCitation
          key={`${match.index}-${match[1]}`}
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
    <div className="flex gap-4 group mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 items-start pr-4">
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 overflow-hidden">
          {!logoError ? (
            <img
              src={logoSrc}
              alt="Vault AI"
              className="w-full h-full object-cover"
              onError={() => setLogoError(true)}
            />
          ) : (
            <Bot size={20} className="text-blue-600 dark:text-blue-400" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">VAULT AI</span>
          <DynamicTimestamp timestamp={message.timestamp} />
        </div>

        {/* [UPDATE] Thinking Process Integration */}
        {/* Now passing both currentStatus AND the full thinkingSteps array */}
        {(isLoading || message.status) && (
          <div className="mb-4 ml-1">
            <ThinkingProcess
              currentStatus={message.status}
              thinkingSteps={message.thinkingSteps}
            />
          </div>
        )}

        <div className="prose prose-slate dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-300 leading-7 text-[15px]">
          <ReactMarkdown
            components={{
              strong: ({ node, ...props }) => <strong className="font-semibold text-zinc-900 dark:text-white" {...props} />,
              p: ({ children }) => <p className="mb-4 last:mb-0"><CustomTextRenderer>{children}</CustomTextRenderer></p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="pl-1"><CustomTextRenderer>{children}</CustomTextRenderer></li>,
              code: ({ inline, children, ...props }) => inline ?
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-sm font-mono text-pink-600 dark:text-pink-400 border border-zinc-200 dark:border-zinc-700">{children}</code> :
                <div className="relative group my-6 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <pre className="bg-zinc-50 dark:bg-[#0d1117] text-zinc-800 dark:text-zinc-100 p-4 overflow-x-auto m-0"><code className="font-mono text-sm" {...props}>{children}</code></pre>
                </div>,
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

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

        {message.sources && message.sources.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px bg-zinc-200 dark:bg-zinc-700 flex-1"></div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2">Sources & References</span>
              <div className="h-px bg-zinc-200 dark:bg-zinc-700 flex-1"></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {message.sources.map((src, idx) => (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSourceClick(src);
                  }}
                  className="group flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-full px-3 py-1.5 cursor-pointer transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:animate-pulse"></div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium truncate max-w-[150px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {src.name}
                  </span>
                  <span className="text-[9px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full border border-zinc-100 dark:border-zinc-700 font-mono">
                    P.{src.page}
                  </span>
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