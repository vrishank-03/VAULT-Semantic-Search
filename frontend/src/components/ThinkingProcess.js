// frontend/src/components/ThinkingProcess.js
// --------------------------------------------------------
// [UX]   Clean "Pulsating Circle" indicator instead of long list
// [FIX]  Handles completion state to stop the spinner
// [LOG]  Atomic logging on every distinct status update
// --------------------------------------------------------

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ThinkingProcess = ({ currentStatus }) => {
  const lastStatusRef = useRef(currentStatus);

  // Atomic logging + completion awareness
  useEffect(() => {
    // If status cleared or explicitly 'Stopped', log once and bail
    if (!currentStatus || currentStatus === 'Stopped') {
      if (lastStatusRef.current && lastStatusRef.current !== 'Stopped') {
        console.log(
          `[ThinkingProcess] Stream complete/stopped. Last status was: "${lastStatusRef.current}"`
        );
      }
      lastStatusRef.current = currentStatus;
      return;
    }

    // Deduplicate logs for repeated status
    if (currentStatus === lastStatusRef.current) return;

    console.log(`[ThinkingProcess] Status Update: "${currentStatus}"`);
    lastStatusRef.current = currentStatus;
  }, [currentStatus]);

  // If no status or explicitly stopped, render nothing
  if (!currentStatus || currentStatus === 'Stopped') return null;

  return (
    <div className="flex items-center gap-3 py-2 w-full max-w-md">
      {/* Pulsating Circle */}
      <div className="relative flex items-center justify-center w-5 h-5">
        {/* Outer Ring */}
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-25"></span>
        {/* Inner Dot */}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </div>

      {/* Animated Status Text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={currentStatus} // triggers animation on text change
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
        >
          {currentStatus}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

export default ThinkingProcess;
