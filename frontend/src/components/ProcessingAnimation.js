import React from 'react';

const ProcessingAnimation = () => {
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 text-white font-sans">
      <div className="flex flex-col items-center">
        {/* The Document Icon and Animation Container */}
        <div className="relative w-28 h-36">
          {/* Document Outline */}
          <div className="w-full h-full bg-gray-700 rounded-lg border-2 border-gray-500 shadow-2xl">
            {/* Page corner fold */}
            <div className="absolute top-0 right-0 w-8 h-8 bg-gray-800" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
            <div className="absolute top-2 right-0 w-8 h-8 border-l-2 border-t-2 border-gray-500"></div>

            {/* Document Lines */}
            <div className="absolute top-8 left-4 right-4 h-1 bg-gray-500 rounded-full opacity-50"></div>
            <div className="absolute top-12 left-4 right-8 h-1 bg-gray-500 rounded-full opacity-50"></div>
            <div className="absolute top-16 left-4 right-4 h-1 bg-gray-500 rounded-full opacity-50"></div>
            <div className="absolute top-20 left-4 right-12 h-1 bg-gray-500 rounded-full opacity-50"></div>
            <div className="absolute top-24 left-4 right-4 h-1 bg-gray-500 rounded-full opacity-50"></div>
          </div>

          {/* The Scanning Line Animation */}
          <div className="scan-line absolute left-0 right-0 h-1 bg-cyan-300 shadow-[0_0_15px_rgba(0,255,255,0.8)]"></div>

          {/* The Bursting Chunks Animation */}
          {/* We create 6 chunks and apply different animation delays and positions */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="chunk"
              style={{
                '--delay': `${i * 0.25}s`,
                '--x': `${Math.cos((i / 6) * 2 * Math.PI) * 100}px`,
                '--y': `${Math.sin((i / 6) * 2 * Math.PI) * 100}px`,
              }}
            ></div>
          ))}
        </div>

        {/* Text Label */}
        <p className="mt-8 text-lg font-medium tracking-widest uppercase animate-pulse">
          Analyzing Document
        </p>
      </div>
    </div>
  );
};

export default ProcessingAnimation;