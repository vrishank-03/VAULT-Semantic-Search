import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// --- [PHASE 1.D] Import new API functions ---
import { 
    getRooms, 
    getPendingProducts,
    approveProduct,
    rejectProduct,
    getAllProducts,
    updateProduct
} from '../services/api';
import Sidebar from '../components/Sidebar'; 
import ThemeToggleButton from '../components/ThemeToggleButton'; 
import Toast from '../Toast';
// --- [PHASE 1.D] Import new icons ---
import { 
    FiPlus, FiLock, FiEye, FiEdit2, FiUsers, FiBell, 
    FiCheckCircle, FiXCircle, FiSave, FiX 
} from 'react-icons/fi';
import LoadingSpinner from '../components/LoadingSpinner';

// --- [TASK 15 REFACTOR] Import the new modal components ---
import UserManagementModal from '../components/modals/UserManagementModal';
import CreateRoomModal from '../components/modals/CreateRoomModal';
import JitRequestModal from '../components/modals/JitRequestModal';
// --- [END REFACTOR] ---


// --- Main Dashboard/Purgatory Page Component ---
function Dashboard() {
    const [rooms, setRooms] = useState([]);
    const [pendingProducts, setPendingProducts] = useState([]);
    
    // --- [PHASE 1.D] State for managing all products ---
    const [allProducts, setAllProducts] = useState([]);
    const [editingProductId, setEditingProductId] = useState(null);
    const [editFormData, setEditFormData] = useState({ productName: '', productOwnerName: '', productOwnerEmail: '' });
    // --- [END PHASE 1.D] ---

    const [isLoading, setIsLoading] = useState(true);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
    const [isJitModalOpen, setIsJitModalOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    console.log('[DASHBOARD_LOG] Page loaded. User:', user);

    // --- [PHASE 1.A LOG] ---
    useEffect(() => {
        if (user) {
            const isCto = user.role === 'CTO';
            console.log(`[DASHBOARD] User role detected: ${user.role}. Quote visibility: ${isCto}`);
        } else {
            console.log('[DASHBOARD] User object not yet available for role check.');
        }
    }, [user]);
    // --- [END LOG] ---

    // --- [PHASE 1.C/1.D] Modified data fetching functions ---
    const fetchRooms = async () => {
        console.log('[DASHBOARD_LOG] Fetching rooms...');
        try {
            const response = await getRooms();
            console.log('[DASHBOARD_LOG] getRooms() API success:', response.data);
            setRooms(response.data);
        } catch (error) {
            console.error('[DASHBOARD_ERROR] Failed to fetch rooms:', error);
            setToast({ message: 'Could not load chat rooms.', type: 'error' });
            throw error; // Re-throw for Promise.all
        }
    };

    const fetchPendingProducts = async () => {
        console.log('[DASHBOARD_LOG] [PHASE 1.C] Fetching pending products...');
        try {
            const response = await getPendingProducts();
            console.log('[DASHBOARD_LOG] [PHASE 1.C] getPendingProducts() API success:', response.data);
            setPendingProducts(response.data);
        } catch (error) {
            console.error('[DASHBOARD_ERROR] [PHASE 1.C] Failed to fetch pending products:', error);
            setToast({ message: 'Could not load pending products.', type: 'error' });
            throw error; // Re-throw for Promise.all
        }
    };

    // [PHASE 1.D] New function to fetch all products
    const fetchAllProducts = async () => {
        console.log('[DASHBOARD_LOG] [PHASE 1.D] Fetching all products...');
        try {
            const response = await getAllProducts();
            console.log('[DASHBOARD_LOG] [PHASE 1.D] getAllProducts() API success:', response.data);
            setAllProducts(response.data);
        } catch (error) {
            console.error('[DASHBOARD_ERROR] [PHASE 1.D] Failed to fetch all products:', error);
            setToast({ message: 'Could not load product list.', type: 'error' });
            throw error; // Re-throw for Promise.all
        }
    };

    // [PHASE 1.D] Load all dashboard data on user load
    useEffect(() => {
        const loadDashboardData = async () => {
            if (!user) {
                console.log('[DASHBOARD_LOG] User not ready, skipping data load.');
                return;
            }
            
            console.log('[DASHBOARD_LOG] User loaded. Loading all dashboard data...');
            setIsLoading(true);
            
            const fetchesToRun = [fetchRooms()]; // Always fetch rooms

            if (user.role === 'CTO') {
                console.log('[DASHBOARD_LOG] [PHASE 1.C] CTO detected, adding pending products to fetch list.');
                fetchesToRun.push(fetchPendingProducts());
                
                // --- [PHASE 1.D] Add fetch for all products ---
                console.log('[DASHBOARD_LOG] [PHASE 1.D] CTO detected, adding ALL products to fetch list.');
                fetchesToRun.push(fetchAllProducts());
                // --- [END PHASE 1.D] ---
            } else {
                console.log('[DASHBOARD_LOG] User is not CTO, skipping fetch for product management.');
            }

            try {
                await Promise.all(fetchesToRun);
                console.log('[DASHBOARD_LOG] All dashboard data loaded.');
            } catch (error) {
                console.error('[DASHBOARD_ERROR] Error loading one or more dashboard data components:', error);
            } finally {
                setIsLoading(false);
                console.log('[DASHBOARD_LOG] Finished all fetches, setting loading to false.');
            }
        };
        
        loadDashboardData();

    }, [user]);
    // --- [END PHASE 1.D] ---

    // --- [PHASE 1.C] Handler to approve a product ---
    const handleApproveProduct = async (productId, productName) => {
        console.log(`[DASHBOARD_LOG] [PHASE 1.C] Attempting to approve product ID: ${productId}`);
        try {
            await approveProduct(productId);
            console.log(`[DASHBOARD_LOG] [PHASE 1.C] Product ${productId} approved.`);
            setToast({ message: `Product "${productName}" approved!`, type: 'success' });
            // Refresh the list of pending products
            fetchPendingProducts();
            fetchAllProducts(); // [PHASE 1.D] Refresh all products list too
        } catch (error) {
            console.error(`[DASHBOARD_ERROR] [PHASE 1.C] Failed to approve product ${productId}:`, error);
            const errorMessage = error.response?.data?.message || 'Failed to approve product.';
            setToast({ message: errorMessage, type: 'error' });
        }
    };
    // --- [END HANDLER] ---

    // --- [PHASE 1.C] NEW Handler to reject a product ---
    const handleRejectProduct = async (productId, productName) => {
        console.log(`[DASHBOARD_LOG] [PHASE 1.C] Attempting to REJECT product ID: ${productId}`);
        if (!window.confirm(`Are you sure you want to REJECT and DELETE the product "${productName}"? This cannot be undone.`)) {
            console.log('[DASHBOARD_LOG] [PHASE 1.C] Product rejection cancelled by user.');
            return;
        }

        try {
            await rejectProduct(productId);
            console.log(`[DASHBOARD_LOG] [PHASE 1.C] Product ${productId} rejected.`);
            setToast({ message: `Product "${productName}" rejected.`, type: 'success' });
            // Refresh the list of pending products
            fetchPendingProducts();
            fetchAllProducts(); // [PHASE 1.D] Refresh all products list too
        } catch (error) {
            console.error(`[DASHBOARD_ERROR] [PHASE 1.C] Failed to reject product ${productId}:`, error);
            const errorMessage = error.response?.data?.message || 'Failed to reject product.';
            setToast({ message: errorMessage, type: 'error' });
        }
    };
    // --- [END NEW HANDLER] ---

    // --- [PHASE 1.D] Handlers for editing products ---
    const handleEditClick = (product) => {
        console.log(`[DASHBOARD_LOG] [PHASE 1.D] Init edit for product ID: ${product.id}`);
        setEditingProductId(product.id);
        setEditFormData({
            productName: product.product_name,
            productOwnerName: product.product_owner_name,
            productOwnerEmail: product.product_owner_email
        });
    };

    const handleEditCancel = () => {
        console.log('[DASHBOARD_LOG] [PHASE 1.D] Cancelled product edit.');
        setEditingProductId(null);
        setEditFormData({ productName: '', productOwnerName: '', productOwnerEmail: '' });
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleEditSave = async (productId) => {
        console.log(`[DASHBOARD_LOG] [PHASE 1.D] Attempting to SAVE product ID: ${productId}`);
        if (!editFormData.productName || !editFormData.productOwnerName || !editFormData.productOwnerEmail) {
            setToast({ message: 'All fields are required.', type: 'error' });
            return;
        }
        try {
            await updateProduct(productId, {
                productName: editFormData.productName,
                productOwnerName: editFormData.productOwnerName,
                productOwnerEmail: editFormData.productOwnerEmail
            });
            console.log(`[DASHBOARD_LOG] [PHASE 1.D] Product ${productId} updated.`);
            setToast({ message: 'Product updated successfully!', type: 'success' });
            setEditingProductId(null);
            
            // Refresh all product data
            fetchPendingProducts();
            fetchAllProducts();
        } catch (error) {
            console.error(`[DASHBOARD_ERROR] [PHASE 1.D] Failed to update product ${productId}:`, error);
            const errorMessage = error.response?.data?.message || 'Failed to update product.';
            setToast({ message: errorMessage, type: 'error' });
        }
    };
    // --- [END PHASE 1.D] ---

    const handleJoinRoom = (room) => {
        console.log(`[DASHBOARD_LOG] Attempting to join room: ${room.name} (ID: ${room.id})`);
        
        if (room.isPasswordProtected) {
            console.log('[DASHBOARD_LOG] Room is password protected.');
            setToast({ message: 'Password protected rooms are not yet implemented.', type: 'warning' });
        } else {
            console.log(`[DASHBOARD_LOG] Room is public. Navigating to /chat/${room.id}`);
            navigate(`/chat/${room.id}`);
        }
    };

    const onRoomCreated = () => {
         console.log('[DASHBOARD_LOG] onRoomCreated callback triggered.');
         fetchRooms();
         setToast({ message: 'Room created successfully!', type: 'success' });
    }

    const onUserManagementUpdate = (toastMessage) => {
        console.log('[DASHBOARD_LOG] onUserManagementUpdate callback triggered.');
        setToast(toastMessage);
    };

    const onJitRequestUpdate = (toastMessage) => {
        console.log('[DASHBOARD_LOG] onJitRequestUpdate callback triggered.');
        setToast(toastMessage);
    };

    // --- [PHASE 1.C] New component to render pending products ---
    const renderPendingProducts = () => {
        if (user?.role !== 'CTO') {
            return null; // Don't render anything if not CTO
        }
        if (isLoading) {
            return null;
        }
        if (pendingProducts.length === 0) {
            console.log('[DASHBOARD_RENDER] [PHASE 1.C] CTO has no pending products to show.');
            return (
                <div className="mb-12">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Pending Product Approvals</h2>
                    <p className="text-gray-500 dark:text-gray-400">There are no products awaiting approval.</p>
                </div>
            );
        }

        console.log('[DASHBOARD_RENDER] [PHASE 1.C] Rendering Pending Products section.');
        return (
            <div className="mb-12">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Pending Product Approvals</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pendingProducts.map((product) => (
                            <li key={product.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{product.product_name}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        <strong>PO:</strong> {product.product_owner_name} ({product.product_owner_email})
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        Requested: {new Date(product.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 flex gap-2">
                                    <button
                                        onClick={() => handleRejectProduct(product.id, product.product_name)}
                                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700"
                                    >
                                        <FiXCircle size={16} />
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleApproveProduct(product.id, product.product_name)}
                                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700"
                                    >
                                        <FiCheckCircle size={16} />
                                        Approve
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };
    // --- [END NEW COMPONENT] ---

    // --- [PHASE 1.D] New component to render ALL products for management ---
    const renderManageAllProducts = () => {
        if (user?.role !== 'CTO') {
            return null;
        }
        if (isLoading) {
            return null;
        }

        console.log('[DASHBOARD_RENDER] [PHASE 1.D] Rendering Manage All Products section.');

        return (
            <div className="mb-12">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Manage All Products</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {allProducts.length === 0 && (
                            <li className="p-4 text-gray-500 dark:text-gray-400">No products found.</li>
                        )}
                        {allProducts.map((product) => (
                            <li key={product.id} className="p-4">
                                {editingProductId === product.id ? (
                                    // --- Edit Mode ---
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
                                            <input
                                                type="text"
                                                name="productName"
                                                value={editFormData.productName}
                                                onChange={handleEditFormChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Owner Name</label>
                                            <input
                                                type="text"
                                                name="productOwnerName"
                                                value={editFormData.productOwnerName}
                                                onChange={handleEditFormChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Owner Email</label>
                                            <input
                                                type="email"
                                                name="productOwnerEmail"
                                                value={editFormData.productOwnerEmail}
                                                onChange={handleEditFormChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={handleEditCancel}
                                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 border border-transparent rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-500"
                                            >
                                                <FiX size={16} />
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleEditSave(product.id)}
                                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                                            >
                                                <FiSave size={16} />
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // --- Display Mode ---
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <div>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{product.product_name}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                <strong>PO:</strong> {product.product_owner_name} ({product.product_owner_email})
                                            </p>
                                            <p className="text-sm mt-1">
                                                {/* --- [FRONTEND_FIX] --- */}
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    product.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                                    (product.status === 'pending' || product.status === 'awaiting_po_activation') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                                }`}>
                                                    {(product.status === 'pending' || product.status === 'awaiting_po_activation') ? 'Pending' : product.status}
                                                </span>
                                                {/* --- [END_FRONTEND_FIX] --- */}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {/* [CAUSALITY_FIX] Only allow editing of 'confirmed' OR 'awaiting_po_activation' products */}
                                            {(product.status === 'confirmed' || product.status === 'awaiting_po_activation') && (
                                                <button
                                                    onClick={() => handleEditClick(product)}
                                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                                                >
                                                    <FiEdit2 size={16} />
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };
    // --- [END NEW COMPONENT] ---

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
        
        if (rooms.length === 0 && (user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO')) {
            console.log('[DASHBOARD_RENDER] No rooms found for Admin/PO/CTO.');
            return (
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>No clients or chat rooms have been created yet.</p>
                    {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
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
                            
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                {user?.role === 'CTO' && (
                                    <span className="font-medium">{room.product_name} / {room.client_name}</span>
                                )}
                                {user?.role === 'ProductOwner' && (
                                    <span className="font-medium">{room.product_name} / {room.client_name}</span>
                                )}
                                {(user?.role === 'Administrator' || user?.role === 'User') && (
                                    <span className="font-medium">Client: {room.client_name}</span>
                                )}
                            </p>

                            <button 
                                onClick={() => handleJoinRoom(room)}
                                className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                            >
                                <FiEye />
                                Join Room
                            </button>
                            {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
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

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Sidebar 
                handleNewChat={() => {}} 
                conversations={[]}      
                onSelectConversation={() => {}} 
            />

            <CreateRoomModal 
                isOpen={isRoomModalOpen}
                onClose={() => setIsRoomModalOpen(false)}
                onSuccess={onRoomCreated}
            />
            
            <UserManagementModal
                isOpen={isUserManagementModalOpen}
                onClose={() => setIsUserManagementModalOpen(false)}
                userRole={user?.role}
                onUpdate={onUserManagementUpdate}
            />

            <JitRequestModal
                isOpen={isJitModalOpen}
                onClose={() => setIsJitModalOpen(false)}
                onUpdate={onJitRequestUpdate}
            />
            
            <main className="flex-grow overflow-y-auto p-6 lg:p-12 relative">
                
                <header className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggleButton />
                </header>
                
                <div className="max-w-7xl mx-auto pt-10">
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
                            {(user?.role === 'Administrator' || user?.role === 'ProductOwner') && (
                                <button
                                    onClick={() => setIsJitModalOpen(true)}
                                    title="JIT Access Requests"
                                    className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-yellow-500 border border-transparent rounded-md shadow-sm hover:bg-yellow-600"
                                >
                                    <FiBell size={18} />
                                    <span className="hidden sm:inline">JIT Requests</span>
                                </button>
                            )}

                            {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
                                <button
                                    onClick={() => setIsUserManagementModalOpen(true)}
                                    title="Manage Users"
                                    className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700"
                                >
                                    <FiUsers size={18} />
                                    <span className="hidden sm:inline">Manage Users</span>
                                </button>
                            )}
                            {(user?.role === 'Administrator' || user?.role === 'ProductOwner' || user?.role === 'CTO') && (
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
                    </div>
                    
                    {/* --- [PHASE 1.C] RENDER PENDING PRODUCTS --- */}
                    {renderPendingProducts()}

                    {/* --- [PHASE 1.D] RENDER ALL PRODUCTS --- */}
                    {renderManageAllProducts()}

                    {/* --- [PHASE 1.C] Added header for rooms list --- */}
                    {!isLoading && (
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                            Chat Rooms
                        </h2>
                    )}
                    
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}

export default Dashboard;