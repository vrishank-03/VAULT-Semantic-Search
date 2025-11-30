import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';

const CitationBadge = ({ source, page, onClick }) => {
  return (
    <span className="relative inline-block group ml-1 align-middle">
      {/* The Trigger Icon (Link Chain) */}
      <span 
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200/50 hover:bg-blue-100 text-gray-500 hover:text-blue-600 cursor-pointer transition-colors duration-200"
        onClick={() => onClick({ name: source, page })}
      >
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </span>

      {/* The Popover Card (Hidden by default, visible on Group Hover) */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 z-50 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 transform origin-bottom scale-95 group-hover:scale-100">
        
        {/* Card Body (Dark Theme like Screenshot) */}
        <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-3 flex items-start gap-3 backdrop-blur-md">
          
          {/* PDF Icon (Red) */}
          <div className="flex-shrink-0 w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
            <FileText size={16} className="text-red-500" />
          </div>

          {/* Text Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-200 truncate leading-tight">
              {source}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Page {page}
            </p>
          </div>

          {/* Click Action */}
          <div 
            className="flex-shrink-0 mt-1 cursor-pointer hover:text-blue-400 text-gray-500 transition-colors"
            onClick={(e) => {
                e.stopPropagation();
                onClick({ name: source, page });
            }}
          >
            <ExternalLink size={14} />
          </div>
        </div>

        {/* Little Arrow pointing down */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-[#1e1e1e] border-b border-r border-gray-700 transform rotate-45"></div>
      </div>
    </span>
  );
};

export default CitationBadge;