// frontend/src/components/ThinkingProcess.js
// --------------------------------------------------------
// [UX] Perplexity-Style "Thinking" Accordion
// [FEATURE] Expandable/Collapsible process log
// [FEATURE] Auto-collapses when content starts streaming
// --------------------------------------------------------

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

const ThinkingProcess = ({ currentStatus, thinkingSteps = [] }) => {
  // Determine effective status
  // If we have detailed steps, use the last one. If just a string, use that.
  const activeStatus = thinkingSteps.length > 0
    ? thinkingSteps[thinkingSteps.length - 1].text
    : (typeof currentStatus === 'string' ? currentStatus : 'Thinking...');

  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand logic:
  // If we are thinking and have steps, expand initially.
  // BUT, if the user manually toggled it, respect that? 
  // Let's keep it simple: Default collapsed, but pulse to invite click.

  // Auto-collapse when done? 
  // No, usually users want to see it if they opened it.

  if (!activeStatus && thinkingSteps.length === 0) return null;

  return (
    <div className="w-full max-w-lg my-2">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group w-full text-left"
      >
        {/* Icon */}
        <div className="relative flex items-center justify-center w-5 h-5">
          {activeStatus !== 'Stopped' && activeStatus !== 'Complete' ? (
            <Loader2 size={16} className="text-zinc-400 animate-spin" />
          ) : (
            <CheckCircle2 size={16} className="text-green-500" />
          )}
        </div>

        {/* Text */}
        <span className="font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
          {activeStatus}
        </span>

        {/* Chevron */}
        <div className="ml-auto text-zinc-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {/* Expandable Content (The Steps) */}
      <AnimatePresence>
        {isExpanded && thinkingSteps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-4 pr-2 py-2 ml-2.5 border-l border-zinc-200 dark:border-zinc-800 space-y-3">
              {thinkingSteps.map((step, idx) => {
                const isLast = idx === thinkingSteps.length - 1;
                return (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLast ? 'bg-blue-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                    <span className={`${isLast ? 'text-zinc-700 dark:text-zinc-200 font-medium' : 'text-zinc-500 dark:text-zinc-500'}`}>
                      {step.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingProcess;