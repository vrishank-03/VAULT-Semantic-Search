// frontend/src/components/dashboard/DashboardTabs.js

import React from 'react';

// --- [BADGE_FIX] New Notification Badge Component ---
const NotificationBadge = ({ count = 0 }) => {
    if (count === 0) return null;
    
    // Show a simple, elegant dot
    return (
        <span className="ml-1.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 animate-ping opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
        </span>
    );
};
// --- [END BADGE_FIX] ---


const DashboardTabs = ({ 
    currentTab, 
    setCurrentTab, 
    outgoingRequestCount, 
    browseTabName, 
    showPeerJitTab,
    userRole,
    outgoingPeerRequestCount // --- [BADGE_FIX] 1. Added new prop ---
}) => {
    return (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                
                {/* --- Browse Tab --- */}
                <button
                    onClick={() => setCurrentTab('browse')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                        currentTab === 'browse'
                            ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                    }`}
                >
                    {browseTabName}
                </button>
                
                {/* --- Outgoing Room JIT Tab --- */}
                {userRole !== 'CTO' && (
                    <button
                        onClick={() => setCurrentTab('outgoing_room')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                            currentTab === 'outgoing_room'
                                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                        }`}
                    >
                        My Room Requests
                        {/* --- [BADGE_FIX] 2. Use new elegant badge --- */}
                        <NotificationBadge count={outgoingRequestCount} />
                    </button>
                )}

                {/* --- Outgoing Peer JIT Tab --- */}
                {showPeerJitTab && (
                    <button
                        onClick={() => setCurrentTab('outgoing_peer')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                            currentTab === 'outgoing_peer'
                                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                        }`}
                    >
                        My Peer Requests
                        {/* --- [BADGE_FIX] 3. Add badge for peer requests --- */}
                        <NotificationBadge count={outgoingPeerRequestCount} />
                    </button>
                )}

            </nav>
        </div>
    );
};

export default DashboardTabs;