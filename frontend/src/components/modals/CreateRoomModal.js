// frontend/src/components/modals/CreateRoomModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion'; // <-- 1. Import motion
import { useAuth } from '../../context/AuthContext';
import { 
    getClients, 
    createClient, 
    createRoom,
    getAllProducts, 
    getTeam,
    getUsersForAdmin // --- [BLOCK 2] NEW IMPORT
} from '../../services/api';
import Toast from '../../Toast';
import { FiPlus, FiX } from 'react-icons/fi';
import Select from 'react-select'; 

// --- 2. Accept animation variants as props ---
const CreateRoomModal = ({ isOpen, onClose, onSuccess, backdropVariants, modalVariants }) => {
    console.log('[MODAL_RENDER] Rendering Create Room Modal.');
    
    const { user } = useAuth(); 

    // Form State
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366F1');
    const [password, setPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [modalToast, setModalToast] = useState(null); 

    // Client State
    const [clients, setClients] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]); 
    const [isClientListLoading, setIsClientListLoading] = useState(true);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);

    // [ROOM_FIX] New Role-Based State
    const [products, setProducts] = useState([]); 
    const [selectedProductId, setSelectedProductId] = useState(''); 
    
    // --- [BLOCK 2] NEW HIERARCHICAL STATE ---
    // State for each role's assignment dropdown
    const [productOwners, setProductOwners] = useState([]); // For CTO
    const [admins, setAdmins] = useState([]); // For PO
    const [users, setUsers] = useState([]); // For Admin

    // State for selected values in each dropdown
    const [selectedPoIds, setSelectedPoIds] = useState([]);
    const [selectedAdminIds, setSelectedAdminIds] = useState([]); 
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    // --- [END BLOCK 2] ---

    // --- Data Fetching ---
    const fetchDropdownData = useCallback(async () => {
        if (!user) {
            console.log('[MODAL_LOG] User not available, skipping data fetch.');
            return;
        }
        console.log('[MODAL_LOG] [BLOCK_2] Fetching data for modal based on role:', user.role);
        setIsClientListLoading(true);
        setModalToast(null);

        try {
            // All roles need clients
            const clientResponse = await getClients();
            console.log(`[MODAL_LOG] Found ${clientResponse.data.length} clients.`);
            setClients(clientResponse.data.map(c => ({ value: c.id, label: c.name, ...c })));

            // --- [BLOCK 2] OVERHAULED DATA FETCHING ---
            
            // CTO needs all products to choose from
            if (user.role === 'CTO') {
                console.log('[MODAL_LOG] [BLOCK_2] Role: CTO. Fetching products and POs.');
                const productResponse = await getAllProducts();
                console.log(`[MODAL_LOG] CTO fetching all products. Found ${productResponse.data.length}.`);
                setProducts(productResponse.data);
                
                // Fetch CTO's team (which are POs)
                const teamResponse = await getTeam();
                const poList = teamResponse.data.filter(m => m.role === 'ProductOwner');
                console.log(`[MODAL_LOG] [BLOCK_2] Found ${poList.length} Product Owners for assignment.`);
                setProductOwners(poList.map(po => ({ value: po.id, label: po.email })));
            }
            
            // ProductOwner needs their team (which are Admins)
            if (user.role === 'ProductOwner') {
                console.log('[MODAL_LOG] [BLOCK_2] Role: ProductOwner. Fetching Admins.');
                const teamResponse = await getTeam(); 
                const adminList = teamResponse.data.filter(m => m.role === 'Administrator' || m.role === 'Admin');
                console.log(`[MODAL_LOG] [BLOCK_2] Found ${adminList.length} Admins for assignment.`);
                setAdmins(adminList.map(a => ({ value: a.id, label: a.email })));
            }

            // Administrator needs their team (which are Users)
            if (user.role === 'Administrator') {
                console.log('[MODAL_LOG] [BLOCK_2] Role: Administrator. Fetching Users.');
                const userResponse = await getUsersForAdmin();
                console.log(`[MODAL_LOG] [BLOCK_2] Found ${userResponse.data.length} Users for assignment.`);
                setUsers(userResponse.data.map(u => ({ value: u.id, label: u.email })));
            }
            // --- [END BLOCK 2] ---
            
        } catch (error) {
            console.error('[MODAL_ERROR] Failed to fetch dropdown data:', error);
            setModalToast({ message: 'Could not load modal data. ' + (error.response?.data?.message || error.message), type: 'error' });
        } finally {
            setIsClientListLoading(false);
        }
    }, [user]); // 'user' is the only dependency
    
    useEffect(() => {
        if (isOpen && user) {
            console.log('[MODAL_EFFECT] Modal opened. Fetching data.');
            // Reset common form state
            setName('');
            setPassword('');
            setSelectedClients([]);
            setNewClientName('');
            setShowNewClientForm(false);
            setModalToast(null);
            
            // Reset product ID (CTO must select, others are fixed)
            setSelectedProductId(user.role === 'CTO' ? '' : user.product_id); 
            
            // --- [BLOCK 2] Reset all assignment states ---
            setSelectedPoIds([]);
            setSelectedAdminIds([]);
            setSelectedUserIds([]);
            
            fetchDropdownData();
        }
    }, [isOpen, user, fetchDropdownData]);

    const filteredClients = user?.role === 'CTO' 
        ? clients.filter(c => c.product_id === parseInt(selectedProductId, 10))
        : clients.filter(c => c.product_id === user?.product_id);

    // --- Handlers ---
    const handleCreateClient = async (e) => {
        // ... (function logic unchanged)
        e.preventDefault();
        setModalToast(null);
        if (!newClientName.trim()) {
            setModalToast({ message: 'Client name is required.', type: 'error' });
            return;
        }
        
        if (user?.role === 'CTO' && !selectedProductId) {
            setModalToast({ message: 'Please select a Product before adding a client.', type: 'error' });
            return;
        }

        console.log(`[MODAL_LOG] Creating new client: ${newClientName}`);
        setIsCreatingClient(true);
        try {
            const clientData = { 
                name: newClientName,
                // For PO/Admin, productId is inferred by backend. For CTO, it's explicit.
                productId: user?.role === 'CTO' ? selectedProductId : undefined
            };
            const response = await createClient(clientData);
            console.log('[MODAL_LOG] Client created successfully:', response.data);
            setModalToast({ message: `Client "${response.data.name}" created!`, type: 'success' });
            
            const newClient = { value: response.data.id, label: response.data.name, ...response.data };
            setClients(prevClients => [...prevClients, newClient]);
            setSelectedClients(prevSelected => [...prevSelected, newClient]); 
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
        console.log('[MODAL_LOG] [BLOCK_2] Create room form submitted.');
        setModalToast(null);

        if (!name) {
            setModalToast({ message: 'Room name is required.', type: 'error' });
            return;
        }
        if (selectedClients.length === 0) { 
            setModalToast({ message: 'Please select at least one client.', type: 'error' });
            return;
        }
        if (user?.role === 'CTO' && !selectedProductId) {
            setModalToast({ message: 'Please select a product.', type: 'error' });
            return;
        }

        setIsCreating(true);
        try {
            // --- [BLOCK 2] OVERHAULED PAYLOAD ---
            const payload = { 
                name, 
                color, 
                password: password || undefined, 
                clientIds: selectedClients.map(c => c.value), 
                // For PO/Admin, productId is inferred. For CTO, it's from selection.
                productId: user?.role === 'CTO' ? selectedProductId : undefined, 
                
                // Add the correct assignment IDs based on role
                // The backend will know which one to read
                poIds: user?.role === 'CTO' ? selectedPoIds.map(p => p.value) : undefined,
                adminIds: user?.role === 'ProductOwner' ? selectedAdminIds.map(a => a.value) : undefined,
                userIds: user?.role === 'Administrator' ? selectedUserIds.map(u => u.value) : undefined
            };
            // --- [END BLOCK 2] ---

            console.log('[MODAL_LOG_API] [BLOCK_2] Calling createRoom() with payload:', payload);
            await createRoom(payload);
            
            console.log('[MODAL_LOG_API_SUCCESS] Room created.');
            onSuccess(); 
            onClose();   
        } catch (error) {
            console.error('[MODAL_ERROR] Failed to create room:', error);
            setModalToast({ message: error.response?.data?.message || 'Failed to create room.', type: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    // Custom styles for react-select to match dark mode
    const selectStyles = {
        control: (styles) => ({ 
            ...styles, 
            backgroundColor: 'var(--select-bg)',
            borderColor: 'var(--select-border)',
            transition: 'all 0.2s ease', // <-- 3. Add transition
            '&:hover': { borderColor: 'var(--select-border-hover)' },
            boxShadow: 'none',
        }),
        menu: (styles) => ({ 
            ...styles, 
            backgroundColor: 'var(--select-menu-bg)',
            zIndex: 9999 
        }),
        option: (styles, { isFocused, isSelected }) => ({
            ...styles,
            backgroundColor: isSelected ? 'var(--select-option-selected)' : isFocused ? 'var(--select-option-focused)' : 'transparent',
            color: 'var(--select-option-color)',
            transition: 'all 0.2s ease', // <-- 3. Add transition
            '&:active': { backgroundColor: 'var(--select-option-selected)' },
        }),
        multiValue: (styles) => ({
            ...styles,
            backgroundColor: 'var(--select-multi-bg)',
            transition: 'all 0.2s ease', // <-- 3. Add transition
        }),
        multiValueLabel: (styles) => ({
            ...styles,
            color: 'var(--select-multi-label)',
        }),
        multiValueRemove: (styles) => ({
            ...styles,
            color: 'var(--select-multi-remove)',
            '&:hover': {
                backgroundColor: 'var(--select-multi-remove-hover-bg)',
                color: 'var(--select-multi-remove-hover-color)',
            },
        }),
        input: (styles) => ({ ...styles, color: 'var(--select-input-color)' }),
        singleValue: (styles) => ({ ...styles, color: 'var(--select-input-color)' }),
        placeholder: (styles) => ({ ...styles, color: 'var(--select-placeholder-color)' }),
    };


    return (
        // --- 3. Wrap entire modal in motion.div ---
        <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
        >
            {/* Modal-specific toast container */}
            <div className="absolute top-0 right-0 p-4">
                {modalToast && <Toast message={modalToast.message} type={modalToast.type} onClose={() => setModalToast(null)} />}
            </div>

            {/* CSS-in-JS for react-select theming */}
            <style>
                {`
                :root {
                    --select-bg: #F9FAFB;
                    --select-border: #D1D5DB;
                    --select-border-hover: #3B82F6;
                    --select-menu-bg: #FFFFFF;
                    --select-option-selected: #3B82F6;
                    --select-option-focused: #EFF6FF;
                    --select-option-color: #111827;
                    --select-multi-bg: #DBEAFE;
                    --select-multi-label: #1E40AF;
                    --select-multi-remove: #93C5FD;
                    --select-multi-remove-hover-bg: #93C5FD;
                    --select-multi-remove-hover-color: #1E40AF;
                    --select-input-color: #111827;
                    --select-placeholder-color: #6B7280;
                }
                .dark {
                    --select-bg: #374151;
                    --select-border: #4B5563;
                    --select-border-hover: #60A5FA;
                    --select-menu-bg: #1F2937;
                    --select-option-selected: #2563EB;
                    --select-option-focused: #374151;
                    --select-option-color: #F9FAFB;
                    --select-multi-bg: #1E3A8A;
                    --select-multi-label: #BFDBFE;
                    --select-multi-remove: #60A5FA;
                    --select-multi-remove-hover-bg: #60A5FA;
                    --select-multi-remove-hover-color: #E0E7FF;
                    --select-input-color: #F9FAFB;
                    --select-placeholder-color: #9CA3AF;
                }
                `}
            </style>

            {/* --- 4. Wrap modal content in motion.div --- */}
            <motion.div 
                className="relative w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
                variants={modalVariants}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200">
                    <FiX size={24} />
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Create New Chat Room</h2>
                <form className="space-y-4" onSubmit={handleCreateRoom}>
                    
                    {user?.role === 'CTO' && (
                        <div>
                            <label htmlFor="product-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Product
                            </label>
                            <Select
                                id="product-select"
                                styles={selectStyles}
                                options={products.map(p => ({ value: p.id, label: p.product_name }))}
                                isLoading={isClientListLoading}
                                isDisabled={isClientListLoading || showNewClientForm}
                                placeholder="Select a product..."
                                onChange={(option) => {
                                    setSelectedProductId(option.value);
                                    setSelectedClients([]); 
                                }}
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client(s)</label>
                        <div className="flex gap-2 mt-1">
                            <Select
                                id="client-select"
                                isMulti
                                styles={selectStyles}
                                options={filteredClients}
                                value={selectedClients}
                                isLoading={isClientListLoading}
                                isDisabled={isClientListLoading || showNewClientForm || (user?.role === 'CTO' && !selectedProductId)}
                                placeholder={isClientListLoading ? 'Loading...' : 'Select client(s)...'}
                                onChange={(options) => setSelectedClients(options || [])} 
                            />
                            <button
                                type="button"
                                title="Add New Client"
                                onClick={() => setShowNewClientForm(prev => !prev)}
                                className={`p-3 rounded-md text-white ${showNewClientForm ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors duration-200`} // <-- 5. Add transition
                            >
                                {showNewClientForm ? <FiX className="transform rotate-45" /> : <FiPlus />}
                            </button>
                        </div>
                    </div>

                    {showNewClientForm && (
                        <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
                            <label htmlFor="new-client-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Client Name</label>
                            <div className="flex gap-2 mt-1">
                                <input 
                                    id="new-client-name" 
                                    type="text" 
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors duration-200" 
                                    placeholder="e.g., ICICI"
                                />
                                <button
                                    type="button"
                                    disabled={isCreatingClient || !newClientName.trim()}
                                    onClick={handleCreateClient}
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                                >
                                    {isCreatingClient ? 'Adding...' : 'Add'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Room Details */}
                    <div>
                        <label htmlFor="room-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Room Name</label>
                        <input 
                            id="room-name" 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required 
                            className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors duration-200" 
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
                            className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors duration-200" 
                            placeholder="Leave blank for public" 
                        />
                    </div>

                    {/* --- [BLOCK 2] OVERHAULED ASSIGNMENT SECTION --- */}
                    
                    {/* CTO View: Assign to POs */}
                    {user?.role === 'CTO' && (
                        <div>
                            <label htmlFor="po-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Assign to Product Owner(s) <span className="text-xs text-gray-400">(Optional)</span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                POs will see this room and can send it downstream to their Admins. Leave blank for a company-wide room.
                            </p>
                            <Select
                                id="po-select"
                                isMulti
                                styles={selectStyles}
                                options={productOwners}
                                value={selectedPoIds}
                                isLoading={isClientListLoading}
                                isDisabled={isClientListLoading}
                                placeholder="Select PO(s) to grant access..."
                                onChange={(options) => setSelectedPoIds(options || [])} 
                            />
                        </div>
                    )}

                    {/* ProductOwner View: Assign to Admins */}
                    {user?.role === 'ProductOwner' && (
                        <div>
                            <label htmlFor="admin-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Assign to Admin(s) <span className="text-xs text-gray-400">(Optional)</span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Admins will see this room and can send it downstream to their Users. Leave blank for a "Product-level" room.
                            </p>
                            <Select
                                id="admin-select"
                                isMulti
                                styles={selectStyles}
                                options={admins}
                                value={selectedAdminIds}
                                isLoading={isClientListLoading}
                                isDisabled={isClientListLoading}
                                placeholder="Select Admin(s) to grant user access..."
                                onChange={(options) => setSelectedAdminIds(options || [])} 
                            />
                        </div>
                    )}

                    {/* Administrator View: Assign to Users */}
                    {user?.role === 'Administrator' && (
                        <div>
                            <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Assign to User(s) <span className="text-xs text-gray-400">(Optional)</span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Assign this room directly to specific users on your team. Leave blank for an "Admin-level" room.
                            </p>
                            <Select
                                id="user-select"
                                isMulti
                                styles={selectStyles}
                                options={users}
                                value={selectedUserIds}
                                isLoading={isClientListLoading}
                                isDisabled={isClientListLoading}
                                placeholder="Select User(s) to grant access..."
                                onChange={(options) => setSelectedUserIds(options || [])} 
                            />
                        </div>
                    )}
                    {/* --- [END BLOCK 2] --- */}


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
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md group hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isCreating || selectedClients.length === 0} 
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                        >
                            {isCreating ? 'Creating...' : 'Create Room'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default CreateRoomModal;