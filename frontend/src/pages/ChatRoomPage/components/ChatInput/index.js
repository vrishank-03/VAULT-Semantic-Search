import React, { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Paperclip, Zap, BookOpen, BrainCircuit, X } from 'lucide-react';
import { motion } from 'framer-motion'; // Required for sleek animations

const ChatInput = ({
  inputMessage,
  setInputMessage,
  handleSendMessage, // This is the parent's handleSearch function wrapper
  isLoading,
  fileInputRef,
  handleFileUpload,
  isUploading,
  handleStopUpload,
  chatMode,
  setChatMode
}) => {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  // --- SUBMISSION HANDLER ---
  // We need to wrap the parent call to prevent default behavior
  const onSubmit = (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() && !isUploading) return;
    handleSendMessage(e);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  // --- CONFIGURATION ---
  const MODES = [
    { id: 'STANDARD', label: 'Auto', icon: Zap, color: 'text-amber-400', desc: 'Fast & Efficient' },
    { id: 'DEEP_THINK', label: 'Reason', icon: BrainCircuit, color: 'text-purple-400', desc: 'Complex Logic' },
    { id: 'DEEP_RESEARCH', label: 'Research', icon: BookOpen, color: 'text-blue-400', desc: 'Long Documents' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-8 pt-2 relative z-50">

      {/* --- THE CAPSULE --- */}
      <div
        className={`
          relative flex flex-col w-full 
          bg-[#1e1e1e]/90 backdrop-blur-xl 
          border transition-all duration-300 ease-out
          rounded-[2rem] shadow-2xl overflow-hidden
          ${isFocused
            ? 'border-gray-500 ring-1 ring-gray-500/30 shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]'
            : 'border-gray-700/50 shadow-lg'}
        `}
      >

        {/* --- UPLOAD OVERLAY --- */}
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 gap-3"
          >
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-medium text-white tracking-wide">Processing Document...</span>
            <button onClick={handleStopUpload} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* --- TEXT AREA --- */}
        <div className="flex items-end gap-3 p-4 pl-5">

          {/* Attachment Trigger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex-shrink-0 mb-1"
            title="Attach file"
          >
            <Paperclip size={20} strokeWidth={2} />
          </button>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* The Input Field */}
          <TextareaAutosize
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isUploading ? "Uploading..." : "Ask anything..."}
            minRows={1}
            maxRows={12}
            className="w-full bg-transparent text-gray-100 placeholder-gray-500 text-[16px] resize-none focus:outline-none py-3 max-h-[40vh] overflow-y-auto leading-relaxed scrollbar-hide font-medium"
          />

          {/* Send Button */}
          <button
            onClick={onSubmit}
            disabled={isLoading || (!inputMessage.trim() && !isUploading)}
            className={`
              p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 mb-1
              ${(inputMessage.trim() && !isLoading)
                ? 'bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
            `}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={20} strokeWidth={2.5} className={inputMessage.trim() ? "ml-0.5" : ""} />
            )}
          </button>
        </div>

        {/* --- THE MODE SELECTOR (Sleek Pill Design) --- */}
        <div className="flex items-center justify-between px-5 pb-4 pt-0 select-none">

          {/* Animated Toggle */}
          <div className="flex items-center bg-black/40 rounded-full p-1 border border-white/5 relative">
            {MODES.map((mode) => {
              const isActive = chatMode === mode.id;
              const Icon = mode.icon;

              return (
                <button
                  key={mode.id}
                  onClick={() => setChatMode(mode.id)}
                  className={`
                      relative z-10 flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold transition-colors duration-300
                      ${isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'}
                    `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activePill"
                      className="absolute inset-0 bg-[#2d2d2d] rounded-full shadow-sm border border-white/10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon size={12} className={isActive ? mode.color : "text-gray-500"} strokeWidth={2.5} />
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Context Helper */}
          <div className="text-[10px] text-gray-500 font-medium hidden sm:flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <span>Pro Tip:</span>
            <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">Shift + Enter</span>
            <span>for new line</span>
          </div>

        </div>
      </div>

      {/* Footer Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-4"
      >
        <p className="text-[10px] text-gray-500 font-medium tracking-wide">
          VAULT can make mistakes. Review generated answers.
        </p>
      </motion.div>
    </div>
  );
};

export default ChatInput;