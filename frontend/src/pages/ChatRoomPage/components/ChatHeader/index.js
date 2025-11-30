// frontend/src/pages/ChatRoomPage/components/ChatHeader/index.js
// --------------------------------------------------------
// [UX FIX] Green Dot now pulses ONLY during upload
// --------------------------------------------------------

import React from 'react';
import { FiSearch, FiFileText, FiLayers } from 'react-icons/fi';
import { useLayout } from '../../../../context/LayoutContext';

const ChatHeader = ({
    title,
    subtitle,
    documentCount,
    onOpenLibrary,
    onShowSearch,
    isUploading // [NEW] Controls the pulse
}) => {
    const { isSidebarOpen } = useLayout();

    return (
        <header className={`
            flex-shrink-0 h-16 w-full 
            bg-white/90 dark:bg-[#111]/95 backdrop-blur-xl 
            border-b border-zinc-200 dark:border-zinc-800 
            flex items-center justify-between pr-6 z-10
            transition-all duration-300 ease-in-out
            ${!isSidebarOpen ? 'pl-14' : 'pl-6'}
        `}>
            {/* Left: Context */}
            <div className="flex flex-col justify-center">
                <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="truncate max-w-[200px] sm:max-w-md">{title || "Loading..."}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        BETA
                    </span>
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <FiLayers size={12} />
                    <span>{subtitle || "Standard Analysis"}</span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <button onClick={onShowSearch} className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
                    <FiSearch size={18} />
                </button>

                <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>

                <button
                    onClick={onOpenLibrary}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 
                        text-xs font-medium rounded-md border 
                        transition-all shadow-sm
                        ${documentCount > 0
                            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            : 'bg-zinc-50 dark:bg-zinc-900/50 border-transparent text-zinc-400 cursor-not-allowed'
                        }
                    `}
                    disabled={documentCount === 0 && !isUploading}
                >
                    <FiFileText size={14} />
                    <span>{documentCount} {documentCount === 1 ? 'Doc' : 'Docs'}</span>

                    {/* [FIX] Only show Pulse if Uploading */}
                    {isUploading && (
                        <span className="flex h-1.5 w-1.5 relative ml-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                        </span>
                    )}
                </button>
            </div>
        </header>
    );
};

export default ChatHeader;