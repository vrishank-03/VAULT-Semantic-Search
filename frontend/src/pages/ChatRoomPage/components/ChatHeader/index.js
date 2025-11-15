// frontend/src/pages/ChatRoomPage/components/ChatHeader/index.js

import React from 'react';
import { FiChevronDown } from 'react-icons/fi';

/**
 * Renders the header for the chat room.
 * Now only contains the button to open the Document Library.
 */
const ChatHeader = ({
    documentCount,
    onShowDocuments
}) => {
    return (
        <header className="absolute top-4 right-4 sm:right-6 lg:right-8 z-10 flex items-center gap-4">
            {documentCount > 0 && (
                <div className="relative">
                    <button
                        onClick={onShowDocuments}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        Show Documents ({documentCount})
                        <FiChevronDown />
                    </button>
                    {/* All dropdown table logic has been removed */}
                </div>
            )}
        </header>
    );
};

export default ChatHeader;