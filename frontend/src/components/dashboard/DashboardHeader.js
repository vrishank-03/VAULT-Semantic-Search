// frontend/src/components/dashboard/DashboardHeader.js
// Corrected - Removed all action buttons

import React from 'react';
// --- [REMOVED] Icons that are no longer needed here ---
// import { FiPlus, FiUsers, FiBell, FiShield } from 'react-icons/fi';

// --- [NOTE] NotificationBadge is defined here but no longer used by this component.
// It can be moved or left here if other components import it.
const NotificationBadge = ({ count = 0, pulse = true }) => {
    if (count === 0) return null;
    
    return (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-red-500 ${pulse ? 'animate-ping' : ''} opacity-75`}></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
        </span>
    );
};


const DashboardHeader = ({
    user,
    // --- [REMOVED] All button props ---
    // incomingRequestsCount,
    // pendingUsersCount, 
    // incomingPeerRequestsCount,
    // onRequestAccessModalOpen,
    // onIncomingJitModalOpen,
    // onUserManagementModalOpen,
    // onCreateRoomModalOpen,
    // onIncomingPeerJitModalOpen 
}) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="mt-1 text-md text-gray-600 dark:text-gray-400">
                    Welcome, <span className="font-semibold">{user?.email}</span>. 
                    {user?.role === 'CTO' ? (
                        <span className="font-semibold"> You are the CTO.</span>
                    ) : (
                        <span> You are a <span className="font-semibold">{user?.role}</span> for <span className="font-semibold">{user?.productName || 'your Product'}</span>.</span>
                    )}
                </p>
                
                {user?.role === 'CTO' && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight" 
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif', letterSpacing: '-0.2px' }}>
                        This isn't about control — it's about omniscient accountability.
                    </p>
                )}
            </div>
            
            {/* --- [REMOVED] Entire button container --- */}
            {/* <div className="flex flex-shrink-0 gap-2"> ... </div> */}
        </div>
    );
};

export default DashboardHeader;