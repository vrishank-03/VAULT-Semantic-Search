// frontend/src/components/dashboard/sections/RoomCardsSection.js

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEdit2, FiSend, FiClock, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi'; 
import SendDownstreamModal from '../../modals/SendDownstreamModal';
import EditRoomModal from '../../modals/EditRoomModal'; 
// --- [BLOCK 6] Import new API functions ---
import { 
    getTeam, 
    sendDownstream, 
    getUsersForAdmin, 
    editRoomPassword, 
    getRoomsForClient, // <-- Fetches rooms for a client
    getRooms, // <-- Fallback for 'User' role
    requestAccess, // <-- For locked rooms
    editRequest
} from '../../../services/api'; 
import { useSocket } from '../../../context/SocketContext';
import LoadingSpinner from '../../LoadingSpinner';
import RequestAccessModal from '../../modals/RequestAccessModal'; // For locked rooms
import RoomPasswordModal from '../../modals/RoomPasswordModal'; // --- [NEW] Import password modal ---

/**
 * Calculates the time left until an expiry date.
 * @param {string} expiresAt - The ISO string of the expiry date.
 * @returns {{text: string, expired: boolean}}
 */
const calculateTimeLeft = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const totalSeconds = Math.floor((expiry - now) / 1000);

    if (totalSeconds <= 0) {
        return { text: "Expired", expired: true };
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    let text = '';
    if (hours > 0) {
        text = `${hours}h ${minutes}m left`;
    } else if (minutes > 0) {
        text = `${minutes}m ${seconds}s left`;
    } else {
        text = `${seconds}s left`;
    }
    return { text, expired: false };
};


// --- [BLOCK 6] Overhauled to fetch its own data ---
const RoomCardsSection = ({ client, onBack, user, setToast, refreshData }) => { 
    const socket = useSocket();
    const navigate = useNavigate();
    
    // --- [BUG_FIX] State is now internal to this component ---
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isDownstreamModalOpen, setIsDownstreamModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRequestAccessModalOpen, setIsRequestAccessModalOpen] = useState(false); // For room JIT
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false); // --- [NEW] State for password modal ---
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [jitTimes, setJitTimes] = useState({});
    
    // --- [BUG_FIX] Fetches its own room data ---
    const fetchRooms = useCallback(async () => {
        if (!user) return;
        
        setIsLoading(true);
        setError(null);
        console.log(`[RoomCardsSection] [BLOCK 6] Fetching rooms for user role: ${user.role}`);

        try {
            let response;
            if (user.role === 'User') {
                // Users get their flat list of rooms
                console.log(`[RoomCardsSection] User role detected. Calling getRooms().`);
                response = await getRooms();
            } else if (client?.id) {
                // Admins, POs, and CTOs get rooms for a specific client
                console.log(`[RoomCardsSection] Client prop found. Calling getRoomsForClient(${client.id}).`);
                response = await getRoomsForClient(client.id);
            } else if (user.role === 'Administrator' && !client?.id) {
                // Admin's initial view (no client selected yet)
                console.log(`[RoomCardsSection] Admin role with no client. Waiting for client selection.`);
                setRooms([]); // Show no rooms until a client is clicked
                setIsLoading(false);
                return;
            } else {
                console.warn('[RoomCardsSection] No client or user role logic matched. Not fetching rooms.');
                setRooms([]);
                setIsLoading(false);
                return;
            }
            
            console.log('[RoomCardsSection] Fetched rooms:', response.data);
            setRooms(response.data);
            
        } catch (err) {
            console.error('[RoomCardsSection] Error fetching rooms:', err);
            setError('Failed to load rooms.');
            setToast({ message: err.response?.data?.message || 'Failed to load rooms.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [user, client, setToast]); // 'client' is now a dependency

    // Initial data fetch
    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    // Socket.io listener
    useEffect(() => {
        if (socket) {
            const handleRefresh = () => {
                console.log("[RoomCardsSection] [SOCKET] Received update. Refreshing rooms.");
                fetchRooms();
            };
            
            socket.on('HIERARCHY_UPDATED', handleRefresh);
            socket.on('ROOM_LIST_UPDATED', handleRefresh);
            socket.on('JIT_REQUEST_UPDATED', handleRefresh); // For room JIT updates

            return () => {
                socket.off('HIERARCHY_UPDATED', handleRefresh);
                socket.off('ROOM_LIST_UPDATED', handleRefresh);
                socket.off('JIT_REQUEST_UPDATED', handleRefresh);
            };
        }
    }, [socket, fetchRooms]);
    
    // JIT Timer Effect
    useEffect(() => {
        console.log("[RoomCardsSection] JIT timer effect registered.");
        const timer = setInterval(() => {
            const newTimes = {};
            let needsRefresh = false;
            
            rooms.forEach(room => {
                const expiry = room.expires_at || room.jit_expires_at; 
                if (expiry) {
                    const { text, expired } = calculateTimeLeft(expiry);
                    if (expired) {
                        needsRefresh = true;
                    } else {
                        newTimes[room.id] = text;
                    }
                }
            });

            setJitTimes(newTimes);

            if (needsRefresh) {
                console.log("[RoomCardsSection] JIT timer expired for one or more rooms. Refreshing data.");
                fetchRooms(); 
            }
        }, 1000); 

        return () => clearInterval(timer);
    }, [rooms, fetchRooms]); // Use fetchRooms as the stable refresh function


    const handleJoinRoom = (room) => {
        console.log(`[RoomCardsSection] [BLOCK_6] Attempting to join room: ${room.name} (ID: ${room.id})`);
        
        const hasJitAccess = !!(room.expires_at || room.jit_expires_at);

        if (room.isPasswordProtected && !hasJitAccess) { 
            // --- [NEW] Open elegant password modal ---
            console.log('[RoomCardsSection] Room is password protected. Opening password modal.');
            setSelectedRoom(room);
            setIsPasswordModalOpen(true);
            // --- [END NEW] ---
        } else {
            if (hasJitAccess) {
                console.log(`[RoomCardsSection] [BLOCK_3] Joining room via JIT access.`);
            } else {
                console.log(`[RoomCardsSection] [BLOCK_2] Room is public. Navigating to /chat/${room.id}`);
            }
            navigate(`/chat/${room.id}`);
        }
    };

    // --- [NEW] Handler for the password modal ---
    const handlePasswordSubmit = (password) => {
        console.log(`[RoomCardsSection] Password submitted. Navigating to /chat/${selectedRoom.id} with password in state.`);
        navigate(`/chat/${selectedRoom.id}`, { state: { password: password } });
        setIsPasswordModalOpen(false);
        setSelectedRoom(null);
    };

    // --- [BLOCK 6] New handler for locked rooms ---
    const handleRequestAccess = (room) => {
        console.log(`[RoomCardsSection] [BLOCK_6] Opening Room JIT modal for room:`, room.name);
        setSelectedRoom(room);
        setIsRequestAccessModalOpen(true);
    };

    const handleOpenDownstreamModal = (room) => {
        console.log(`[RoomCardsSection] Opening Send Downstream modal for room: ${room.name}`);
        setSelectedRoom(room);
        setIsDownstreamModalOpen(true);
    };

    const handleOpenEditModal = (room) => {
        console.log(`[RoomCardsSection] [BLOCK_2] Opening Edit Password modal for room: ${room.name}`);
        setSelectedRoom(room);
        setIsEditModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-500 dark:text-red-400 mt-10">
                <FiAlertTriangle className="mx-auto h-12 w-12" />
                <p className="mt-2">{error}</p>
            </div>
        );
    }

    return (
        <>
            {/* --- [BLOCK 6] Navigation Header --- */}
            <div className="flex items-center mb-6">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        <FiArrowLeft size={16} />
                        Back to Clients
                    </button>
                )}
            </div>
            {client && (
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    Rooms for <span className="text-blue-600 dark:text-blue-400">{client.name}</span>
                </h2>
            )}
            {/* --- [END BLOCK 6] --- */}

            {rooms.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                    {user.role === 'User' ? (
                        <>
                            <p>You have not been assigned to any rooms yet.</p>
                            <p className="mt-2">Please contact your administrator or request access to a room using the '+' button.</p>
                        </>
                    ) : (
                        <p>No rooms have been created for this client yet.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rooms.map((room) => (
                        <div 
                            key={room.id}
                            className={`
                                relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform 
                                transition-all duration-300 ease-in-out group
                                ${room.accessLevel === 'locked' ? 'opacity-60' : 'hover:scale-[1.03] hover:shadow-2xl'}
                            `}
                            style={{ borderTop: `4px solid ${room.color || '#4F46E5'}` }}
                        >
                            {jitTimes[room.id] && (
                                <div 
                                    className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-bold px-2 py-1 rounded-full shadow-lg"
                                    title={`JIT Access expires at ${new Date(room.expires_at || room.jit_expires_at).toLocaleString()}`}
                                >
                                    <FiClock size={12} />
                                    <span>{jitTimes[room.id]}</span>
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate" title={room.name}>{room.name}</h3>
                                    {room.isPasswordProtected && (
                                        <FiLock className="text-gray-400" title="Password Protected" />
                                    )}
                                </div>
                                
                                {room.room_code && (
                                    <p className="text-xs font-mono text-blue-500 dark:text-blue-400 mb-6">
                                        Code: {room.room_code}
                                    </p>
                                )}

                                <div className="space-y-2">
                                    {room.accessLevel === 'locked' ? (
                                        <button 
                                            onClick={() => handleRequestAccess(room)}
                                            className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 transition-colors duration-200"
                                        >
                                            <FiLock size={14} />
                                            Request Access
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleJoinRoom(room)}
                                            className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors duration-200"
                                        >
                                            <FiEye />
                                            Join Room
                                        </button>
                                    )}
                                    
                                    {(user?.role === 'ProductOwner' || user?.role === 'Administrator') && room.isDownstreamable && (
                                        <button 
                                            onClick={() => handleOpenDownstreamModal(room)}
                                            className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 transition-colors duration-200"
                                        >
                                            <FiSend />
                                            Send Downstream
                                        </button>
                                    )}
                                    
                                    {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
                                        <button 
                                            onClick={() => handleOpenEditModal(room)}
                                            className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                                        >
                                            <FiEdit2 />
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Render Modals */}
            {selectedRoom && (
                <>
                    <SendDownstreamModal
                        isOpen={isDownstreamModalOpen}
                        onClose={() => setIsDownstreamModalOpen(false)}
                        room={selectedRoom}
                        setToast={setToast}
                        refreshData={refreshData} 
                        userRole={user.role}
                        api={{ getTeam, sendDownstream, getUsersForAdmin }} 
                    />
                    <EditRoomModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        room={selectedRoom}
                        setToast={setToast}
                        refreshData={refreshData}
                        api={{ editRoomPassword }}
                    />
                    <RequestAccessModal
                        isOpen={isRequestAccessModalOpen}
                        onClose={() => {
                            setIsRequestAccessModalOpen(false);
                            setSelectedRoom(null);
                        }}
                        onSuccess={(toastMessage) => {
                            setToast(toastMessage);
                            refreshData(); // Refresh all data
                        }}
                        api={{ requestAccess, editRequest }}
                        initialRoomCode={selectedRoom.room_code}
                    />
                    {/* --- [NEW] Render the password modal --- */}
                    <RoomPasswordModal
                        isOpen={isPasswordModalOpen}
                        onClose={() => {
                            setIsPasswordModalOpen(false);
                            setSelectedRoom(null);
                        }}
                        onSubmit={handlePasswordSubmit}
                        roomName={selectedRoom.name}
                    />
                </>
            )}
        </>
    );
};

export default RoomCardsSection;