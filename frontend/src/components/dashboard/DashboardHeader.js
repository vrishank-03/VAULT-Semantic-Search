// frontend/src/components/dashboard/DashboardHeader.js

import React from 'react';
// --- [BADGE_FIX] Import new icon ---
import { FiPlus, FiUsers, FiBell, FiShield } from 'react-icons/fi';

// --- [BADGE_FIX] New Notification Badge Component ---
const NotificationBadge = ({ count = 0, pulse = true }) => {
    if (count === 0) return null;
    
    // Show a pulsing dot if count > 0
    return (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-red-500 ${pulse ? 'animate-ping' : ''} opacity-75`}></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
        </span>
    );
};
// --- [END BADGE_FIX] ---

const DashboardHeader = ({
    user,
    incomingRequestsCount,
    pendingUsersCount, 
    incomingPeerRequestsCount, // --- [BADGE_FIX] 1. Added new prop ---
    onRequestAccessModalOpen,
    onIncomingJitModalOpen,
    onUserManagementModalOpen,
    onCreateRoomModalOpen,
    onIncomingPeerJitModalOpen 
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
                        This isn't about power — it's about omniscient accountability.
                    </p>
                )}
            </div>
            
            <div className="flex flex-shrink-0 gap-2">
                
                {user?.role !== 'CTO' && (
                    <button
                        onClick={onRequestAccessModalOpen}
                        title="Request Room Access"
                        className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                    >
                        <FiPlus size={18} />
                        <span className="hidden sm:inline">Request Access</span>
                    </button>
                )}


                {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
                    <>
                        <button
                            onClick={onIncomingJitModalOpen}
                            title="Incoming Room JIT Requests"
                            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-yellow-500 border border-transparent rounded-md shadow-sm hover:bg-yellow-600 relative"
                        >
                            <FiBell size={18} />
                            <span className="hidden sm:inline">Room JIT</span>
                            {/* --- [BADGE_FIX] 2. Use new badge component --- */}
                            <NotificationBadge count={incomingRequestsCount} />
                        </button>

                        {(user?.role === 'Administrator' || user?.role === 'ProductOwner') && (
                             <button
                                onClick={onIncomingPeerJitModalOpen}
                                title="Incoming Peer JIT Requests"
                                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md shadow-sm hover:bg-purple-700 relative"
                            >
                                <FiShield size={18} />
                                <span className="hidden sm:inline">Peer JIT</span>
                                {/* --- [BADGE_FIX] 3. Use new badge component with new count --- */}
                                <NotificationBadge count={incomingPeerRequestsCount} />
                            </button>
                        )}

                        <button
                            onClick={onUserManagementModalOpen}
                            title="Manage Users"
                            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 relative"
                        >
                            <FiUsers size={18} />
                            <span className="hidden sm:inline">Manage Users</span>
                            {/* --- [BADGE_FIX] 4. Use new badge component --- */}
                            <NotificationBadge count={pendingUsersCount} />
                        </button>
                        
                        <button
                            onClick={onCreateRoomModalOpen}
                            title="Create New Room"
                            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 border border-transparent rounded-md shadow-sm hover:bg-gray-800 dark:hover:bg-gray-500"
                        >
                            <FiPlus size={18} />
                            <span className="hidden sm:inline">Create Room</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default DashboardHeader;