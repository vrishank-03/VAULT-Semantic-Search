import React, { useState, useEffect } from 'react';
import { getClients, createClient, createRoom } from '../../services/api';
import Toast from '../../Toast';
import { FiPlus } from 'react-icons/fi';

const CreateRoomModal = ({ isOpen, onClose, onSuccess }) => {
    console.log('[MODAL_RENDER] Rendering Create Room Modal.');
    
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366F1'); // Default color
    const [password, setPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [modalToast, setModalToast] = useState(null); // Modal-specific toast

    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [isClientListLoading, setIsClientListLoading] = useState(true);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);

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
    }, [isOpen]);

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

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        console.log('[MODAL_LOG] Create room form submitted.');
        setModalToast(null);

        if (!name) {
            setModalToast({ message: 'Room name is required.', type: 'error' });
            return;
        }
        if (!selectedClientId) {
            setModalToast({ message: 'Please select a client for this room.', type: 'error' });
            return;
        }

        setIsCreating(true);
        try {
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

    if (!isOpen) return null;

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

export default CreateRoomModal;