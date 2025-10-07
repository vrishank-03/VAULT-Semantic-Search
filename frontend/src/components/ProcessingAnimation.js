import React, { useEffect } from 'react';

// This component now includes all necessary styles and logic to be a self-contained,
// professional, and truly blocking processing screen.
const ProcessingAnimation = () => {

  // This effect adds an event listener to block keyboard interactions (like pressing Enter)
  // while the animation is on screen. It cleans up after itself when unmounted.
  useEffect(() => {
    const preventInteraction = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('keydown', preventInteraction, true);

    return () => {
      document.removeEventListener('keydown', preventInteraction, true);
    };
  }, []);

  return (
    <>
      {/* This <style> tag injects the necessary CSS animations directly. */}
      <style>{`
        .arc-spinner {
          width: 5rem; /* 80px */
          height: 5rem; /* 80px */
          animation: arc-rotate 2.2s linear infinite;
        }
        .arc-spinner-path {
          stroke: #3b82f6; /* A modern blue, you can change this */
          stroke-linecap: round;
          animation: arc-dash 1.65s ease-in-out infinite;
        }
        @keyframes arc-rotate {
          100% { transform: rotate(360deg); }
        }
        @keyframes arc-dash {
          0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 120, 200;
            stroke-dashoffset: -45px;
          }
          100% {
            stroke-dasharray: 120, 200;
            stroke-dashoffset: -165px;
          }
        }
      `}</style>

      {/* The main overlay container. It's designed to capture all mouse clicks. */}
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-50 text-white font-sans cursor-wait">
        <div className="flex flex-col items-center gap-6">
          
          {/* The new, professional SVG spinner animation */}
          <svg className="arc-spinner" viewBox="0 0 80 80">
            <circle
              className="arc-spinner-path"
              cx="40"
              cy="40"
              r="30"
              fill="none"
              strokeWidth="6"
            ></circle>
          </svg>

          {/* Updated text with a subtle pulse animation */}
          <p className="text-lg font-medium tracking-wider text-gray-300 animate-pulse">
            Processing Document...
          </p>
        </div>
      </div>
    </>
  );
};

export default ProcessingAnimation;