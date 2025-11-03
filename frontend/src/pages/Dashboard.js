// --- [NEW] This is the new "Purgatory Page" Dashboard ---
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// --- [MODIFIED] Import ALL new API functions ---
import { 
    getRooms, 
    createRoom, 
    getClients, 
    createClient,
    getPendingUsers,
    approveUser,
    rejectUser // --- [NEW] ---
} from '../services/api';
import Sidebar from '../components/Sidebar'; 
import ThemeToggleButton from '../components/ThemeToggleButton'; 
import Toast from '../Toast';
// --- [MODIFIED] Import new icons ---
import { FiPlus, FiLock, FiEye, FiEdit2, FiUserCheck, FiUsers, FiX, FiTrash2 } from 'react-icons/fi';
import LoadingSpinner from '../components/LoadingSpinner';

// --- [NEW] User Approval Modal Component ---
const UserApprovalModal = ({ isOpen, onClose, userRole, onUpdate }) => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPending = async () => {
        console.log('[USER_APPROVAL_MODAL] Fetching pending users...');
        setIsLoading(true);
        setError(null);
        try {
            const response = await getPendingUsers();
            console.log('[USER_APPROVAL_MODAL] Fetched pending users:', response.data);
            setPendingUsers(response.data);
        } catch (err) {
            console.error('[USER_APPROVAL_MODAL] Error fetching users:', err);
            setError(err.response?.data?.message || 'Failed to load pending users.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchPending();
        }
    }, [isOpen]);

    const handleApprove = async (userId, email) => {
        console.log(`[USER_APPROVAL_MODAL] Attempting to approve user ${userId}`);
        try {
            await approveUser(userId);
            console.log(`[USER_APPROVAL_MODAL] Successfully approved user ${userId}`);
            onUpdate({ message: `User ${email} approved successfully!`, type: 'success' });
            // Refresh list
            fetchPending();
        } catch (err) {
            console.error(`[USER_APPROVAL_MODAL] Error approving user ${userId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to approve user.', type: 'error' });
        }
    };

    // --- [NEW] Handler for rejecting a user ---
    const handleReject = async (userId, email) => {
        console.log(`[USER_APPROVAL_MODAL] Attempting to REJECT user ${userId}`);
        // Simple confirmation before deleting
        if (!window.confirm(`Are you sure you want to reject and delete the user ${email}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            await rejectUser(userId);
            console.log(`[USER_APPROVAL_MODAL] Successfully rejected user ${userId}`);
            onUpdate({ message: `User ${email} rejected and deleted.`, type: 'success' });
            // Refresh list
            fetchPending();
        } catch (err) {
            console.error(`[USER_APPROVAL_MODAL] Error rejecting user ${userId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to reject user.', type: 'error' });
        }
    };
    // --- [END NEW] ---

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-2xl p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                    <FiX size={24} />
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Pending User Approvals</h2>
                
                {error && <p className="text-center text-red-500">{error}</p>}
                
                <div className="max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <LoadingSpinner />
                        </div>
                    ) : pendingUsers.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-10">There are no users pending approval.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role Requested</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {pendingUsers.map(user => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.role}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                                {user.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        {/* --- [MODIFIED] Added Reject Button --- */}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4">
                                            <button 
                                                onClick={() => handleApprove(user.id, user.email)}
                                                className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                            >
                                                <FiUserCheck size={16} />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(user.id, user.email)}
                                                className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                <FiTrash2 size={16} />
                                                Reject
                                            </button>
                                        </td>
                                        {/* --- [END MODIFIED] --- */}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
// --- [END NEW] ---


// --- [MODIFIED] CreateRoomModal (now client-aware) ---
const CreateRoomModal = ({ isOpen, onClose, onSuccess }) => {
    console.log('[MODAL_RENDER] Rendering Create Room Modal.');
    
    // --- State for the form ---
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366F1'); // Default color
    const [password, setPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [modalToast, setModalToast] = useState(null); // Modal-specific toast

    // --- [NEW] State for Client Management ---
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [isClientListLoading, setIsClientListLoading] = useState(true);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    // --- [END NEW] ---

    // --- [NEW] Fetch clients when modal opens ---
    const fetchClients = async () => {
        console.log('[MODAL_LOG] Fetching clients for admin...');
        setIsClientListLoading(true);
        try {
            const response = await getClients();
            console.log(`[MODAL_LOG] Found ${response.data.length} clients.`);
            setClients(response.data);
        } catch (error) {
            console.error('[MODAL_ERROR] Failed to fetch clients:', error);
            setModalToast({ message: 'Could not load client list.', type: 'error' });
        } finally {
            setIsClientListLoading(false);
        }
    };
    
    useEffect(() => {
        if (isOpen) {
            console.log('[MODAL_EFFECT] Modal opened. Fetching clients.');
            // Reset form
            setName('');
            setPassword('');
            setSelectedClientId('');
            setNewClientName('');
            setShowNewClientForm(false);
            setModalToast(null);
            // Fetch client list
            fetchClients();
        }
    }, [isOpen]); // Only re-run when modal opens
    // --- [END NEW] ---

    // --- [NEW] Handler for creating a new client ---
    const handleCreateClient = async (e) => {
        e.preventDefault();
        setModalToast(null);
        if (!newClientName.trim()) {
            setModalToast({ message: 'Client name is required.', type: 'error' });
            return;
        }
        console.log(`[MODAL_LOG] Creating new client: ${newClientName}`);
        setIsCreatingClient(true);
        try {
            const response = await createClient({ name: newClientName });
            console.log('[MODAL_LOG] Client created successfully:', response.data);
            setModalToast({ message: `Client "${response.data.name}" created!`, type: 'success' });
            
            // --- Add new client to list, hide form, and auto-select it ---
            const newClient = response.data;
            setClients(prevClients => [...prevClients, newClient]);
            setSelectedClientId(newClient.id.toString()); // Auto-select the new client (ensure string)
            setNewClientName('');
            setShowNewClientForm(false);

        } catch (error) {
            console.error('[MODAL_ERROR] Failed to create client:', error);
            setModalToast({ message: error.response?.data?.message || 'Failed to create client.', type: 'error' });
        } finally {
            setIsCreatingClient(false);
        }
    };
    // --- [END NEW] ---

    // --- [MODIFIED] Handler for creating the room ---
    const handleCreateRoom = async (e) => {
        e.preventDefault();
        console.log('[MODAL_LOG] Create room form submitted.');
        setModalToast(null);

        // --- [MODIFIED] Validate both name and client_id ---
        if (!name) {
            setModalToast({ message: 'Room name is required.', type: 'error' });
            return;
        }
        if (!selectedClientId) {
            setModalToast({ message: 'Please select a client for this room.', type: 'error' });
            return;
        }
        // --- [END MODIFIED] ---

        setIsCreating(true);
        try {
            // --- [MODIFIED] Payload now includes client_id ---
            const payload = { 
                name, 
                color, 
                password: password || undefined, 
                client_id: parseInt(selectedClientId, 10) // Ensure it's a number
            };
            console.log('[MODAL_LOG_API] Calling createRoom() with payload:', payload);
            await createRoom(payload);
            
            console.log('[MODAL_LOG_API_SUCCESS] Room created.');
            onSuccess(); // Call parent's success function (refreshes list, shows main toast)
            onClose();   // Close modal
        } catch (error) {
            console.error('[MODAL_ERROR] Failed to create room:', error);
            setModalToast({ message: error.response?.data?.message || 'Failed to create room.', type: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null; // Conditional return is now *after* hooks

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Modal-specific toast container */}
            <div className="absolute top-0 right-0 p-4">
                {modalToast && <Toast message={modalToast.message} type={modalToast.type} onClose={() => setModalToast(null)} />}
            </div>

            <div 
                className="relative w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Create New Chat Room</h2>
                <form className="space-y-4" onSubmit={handleCreateRoom}>
                    
                    {/* --- [NEW] Client Dropdown / Creator --- */}
                    <div>
                        <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client</label>
                        <div className="flex gap-2 mt-1">
                            <select 
                                id="client-select" 
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                disabled={isClientListLoading || showNewClientForm}
                                required
                                className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50"
                            >
                                <option value="" disabled>{isClientListLoading ? 'Loading clients...' : 'Select a client...'}</option>
                                {!isClientListLoading && clients.length === 0 && (
                                    <option value="" disabled>No clients found. Add one.</option>
                                )}
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>{client.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                title="Add New Client"
                                onClick={() => setShowNewClientForm(prev => !prev)}
                                className={`p-3 rounded-md text-white ${showNewClientForm ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {showNewClientForm ? <FiPlus className="transform rotate-45" /> : <FiPlus />}
                            </button>
                        </div>
                    </div>

                    {showNewClientForm && (
                        <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-md animate-in fade-in duration-300">
                            <label htmlFor="new-client-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Client Name</label>
                            <div className="flex gap-2 mt-1">
                                <input 
                                    id="new-client-name" 
                                    type="text" 
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" 
                                    placeholder="e.g., ICICI"
                                />
                                <button
                                    type="button"
                                    disabled={isCreatingClient || !newClientName.trim()}
                                    onClick={handleCreateClient}
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isCreatingClient ? 'Adding...' : 'Add'}
                                </button>
                            </div>
                        </div>
                    )}
                    {/* --- [END NEW] --- */}

                    <div>
                        <label htmlFor="room-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Room Name</label>
                        <input 
                            id="room-name" 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required 
                            className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" 
                            placeholder="e.g., Q4 Analysis"
                        />
                    </div>
                    <div>
                        <label htmlFor="room-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Room Password (Optional)</label>
                        <input 
                            id="room-password" 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)} 
                            className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" 
                            placeholder="Leave blank for public" 
                        />
                    </div>
                    <div>
                        <label htmlFor="room-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Room Color</label>
                        <input 
                            id="room-color" 
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="mt-1 w-full h-10 p-1 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer"
                        />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            disabled={isCreating}
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md group hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isCreating || !selectedClientId} 
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isCreating ? 'Creating...' : 'Create Room'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
// --- [END FIX] ---


// --- Main Dashboard/Purgatory Page Component ---
function Dashboard() {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    // --- [NEW] State for Admin Panel ---
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    // --- [END NEW] ---
    const [toast, setToast] = useState(null);
    const { user } = useAuth(); // Get user info (including role and productName)
    const navigate = useNavigate();

    console.log('[DASHBOARD_LOG] Page loaded. User:', user);

    // --- [NEW] Fetch rooms on page load ---
    const fetchRooms = async () => {
        console.log('[DASHBOARD_LOG] Fetching rooms...');
        setIsLoading(true);
        try {
            const response = await getRooms();
            console.log('[DASHBOARD_LOG] getRooms() API success:', response.data);
            setRooms(response.data);
        } catch (error) {
            console.error('[DASHBOARD_ERROR] Failed to fetch rooms:', error);
            setToast({ message: 'Could not load chat rooms.', type: 'error' });
        } finally {
            setIsLoading(false);
            console.log('[DASHBOARD_LOG] Finished fetching rooms.');
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    // --- [NEW] Handler to join a room ---
    const handleJoinRoom = (room) => {
        console.log(`[DASHBOARD_LOG] Attempting to join room: ${room.name} (ID: ${room.id})`);
        
        if (room.isPasswordProtected) {
            console.log('[DASHBOARD_LOG] Room is password protected.');
            // TODO: Show password prompt modal
            setToast({ message: 'Password protected rooms are not yet implemented.', type: 'warning' });
        } else {
            console.log(`[DASHBOARD_LOG] Room is public. Navigating to /chat/${room.id}`);
            // --- [NEW] This will be the route for our new chat page ---
            navigate(`/chat/${room.id}`);
        }
    };

    // --- [NEW] Success handler for modal ---
    const onRoomCreated = () => {
         console.log('[DASHBOARD_LOG] onRoomCreated callback triggered.');
         fetchRooms(); // Refresh the list
         setToast({ message: 'Room created successfully!', type: 'success' }); // Show toast on main page
    }

    // --- [NEW] Handler for user approval success ---
    const onUserApproved = (toastMessage) => {
        console.log('[DASHBOARD_LOG] onUserApproved callback triggered.');
        setToast(toastMessage); // Show the success/error toast on the main dashboard
    };

    // --- [NEW] Component: The main page content ---
    const renderContent = () => {
        if (isLoading) {
            console.log('[DASHBOARD_RENDER] Showing LoadingSpinner.');
            return (
                <div className="flex justify-center items-center h-64">
                    <LoadingSpinner />
                </div>
            );
        }

        if (rooms.length === 0 && user?.role === 'User') {
            console.log('[DASHBOARD_RENDER] No rooms found for User.');
            return (
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>You have not been assigned to any clients or rooms yet.</p>
                    <p className="mt-2">Please contact your administrator.</p>
                </div>
            );
        }
        
        if (rooms.length === 0 && (user?.role === 'Administrator' || user?.role === 'ProductOwner')) {
            console.log('[DASHBOARD_RENDER] No rooms found for Admin/PO.');
            return (
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>No clients or chat rooms have been created yet.</p>
                    {user?.role === 'Administrator' && (
                        <p className="mt-2">Click "Create New Room" to get started.</p>
                    )}
                </div>
            );
        }

        console.log(`[DASHBOARD_RENDER] Rendering ${rooms.length} room cards.`);
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map((room) => (
                    <div 
                        key={room.id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform transition-all hover:scale-105"
                        style={{ borderTop: `4px solid ${room.color || '#4F46E5'}` }}
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate" title={room.name}>{room.name}</h3>
                                {room.isPasswordProtected && (
                                    <FiLock className="text-gray-400" title="Password Protected" />
                                )}
                            </div>
                            
                            {/* --- [NEW] Show Client/Product context --- */}
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                {user?.role === 'ProductOwner' && (
                                    <span className="font-medium">{room.product_name} / {room.client_name}</span>
                                )}
                                {(user?.role === 'Administrator' || user?.role === 'User') && (
                                    <span className="font-medium">Client: {room.client_name}</span>
                                )}
                            </p>
                            {/* --- [END NEW] --- */}

                            <button 
                                onClick={() => handleJoinRoom(room)}
                                className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                            >
                                <FiEye />
                                Join Room
                            </button>
                            {user?.role === 'Administrator' && (
                                <button 
                                    onClick={() => setToast({ message: 'Editing rooms not yet implemented.', type: 'info' })}
                                    className="w-full flex justify-center items-center gap-2 px-4 py-2 mt-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    <FiEdit2 />
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // --- [NEW] Main JSX Return ---
    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Sidebar 
                handleNewChat={() => {}} 
                conversations={[]}       
                onSelectConversation={() => {}} 
            />

            {/* Modal for creating a room */}
            <CreateRoomModal 
                isOpen={isRoomModalOpen}
                onClose={() => setIsRoomModalOpen(false)}
                onSuccess={onRoomCreated}
            />
            
            {/* --- [NEW] Modal for User Approval --- */}
            <UserApprovalModal
                isOpen={isAdminPanelOpen}
                onClose={() => setIsAdminPanelOpen(false)}
                userRole={user?.role}
                onUpdate={onUserApproved}
            />
            {/* --- [END NEW] --- */}
            
            {/* Main Content Area */}
            <main className="flex-grow overflow-y-auto p-6 lg:p-12 relative">
                
                <header className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggleButton />
                </header>
                
                <div className="max-w-7xl mx-auto pt-10">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Chat Rooms
                            </h1>
                            <p className="mt-1 text-md text-gray-600 dark:text-gray-400">
                                Welcome, <span className="font-semibold">{user?.email}</span>. 
                                You are a <span className="font-semibold">{user?.role}</span> for <span className="font-semibold">{user?.productName || 'your Product'}</span>.
                            </p>
                        </div>
                        
                        {/* --- [NEW] Button Container for Admin actions --- */}
                        <div className="flex flex-shrink-0 gap-2">
                            {(user?.role === 'Administrator' || user?.role === 'ProductOwner') && (
                                <button
                                    onClick={() => setIsAdminPanelOpen(true)}
                                    title="Manage Users"
                                    className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700"
                                >
                                    <FiUsers size={18} />
                                    <span className="hidden sm:inline">Manage Users</span>
                                </button>
                            )}
                            {user?.role === 'Administrator' && (
                                <button
                                    onClick={() => setIsRoomModalOpen(true)}
                                    title="Create New Room"
                                    className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                                >
                                    <FiPlus size={18} />
                                    <span className="hidden sm:inline">Create Room</span>
                                </button>
                            )}
                        </div>
                        {/* --- [END NEW] --- */}
                    </div>
                    
                    {/* Room Grid */}
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}

export default Dashboard;

