// frontend/src/pages/Dashboard.js
// Corrected Refactor

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    approveRoomRequest,
    rejectRoomRequest,
    revokeRequest,
    requestAccess,
    editRequest,
    rejectProduct,
    deleteProduct,
    getIncomingPeerRequests,
    getOutgoingPeerRequests,
    respondToPeerRequest
} from '../services/api';
import Toast from '../Toast';
import LoadingSpinner from '../components/LoadingSpinner';

// New Refactored Imports
import { useDashboardData } from '../components/dashboard/hooks/useDashboardData';
import { useProductManagement } from '../components/dashboard/hooks/useProductManagement';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardTabs from '../components/dashboard/DashboardTabs'; // We will use this again
import PendingProductsSection from '../components/dashboard/sections/PendingProductsSection';
import ManageProductsSection from '../components/dashboard/sections/ManageProductsSection';
import ProductCardsSection from '../components/dashboard/sections/ProductCardsSection';
import ClientCardsSection from '../components/dashboard/sections/ClientCardsSection';
import RoomCardsSection from '../components/dashboard/sections/RoomCardsSection';
import OutgoingRequestsSection from '../components/dashboard/sections/OutgoingRequestsSection';
import OutgoingPeerRequestsSection from '../components/dashboard/sections/OutgoingPeerRequestsSection';

// Modals
import UserManagementModal from '../components/modals/UserManagementModal';
import CreateRoomModal from '../components/modals/CreateRoomModal';
import IncomingJitModal from '../components/modals/IncomingJitModal';
import IncomingPeerJitModal from '../components/modals/IncomingPeerJitModal';
import RequestAccessModal from '../components/modals/RequestAccessModal';
import ConfirmModal from '../components/modals/ConfirmModal';

// --- [NEW] Import layout context and icons for *correct* sidebar ---
import { useLayout } from '../context/LayoutContext';
import { FiUsers, FiPlusSquare, FiPenTool, FiBell, FiShare2 } from 'react-icons/fi'; // Corrected Icons

// Animation Variants
const modalBackdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const modalContentVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { delay: 0.1, ease: 'easeOut', duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { ease: 'easeIn', duration: 0.15 } },
};

const tabContentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeInOut' } },
};


function Dashboard() {
    const { user } = useAuth();
    const [toast, setToast] = useState(null);
    const [currentTab, setCurrentTab] = useState('browse');

    // --- [NEW] Get setSidebarContent from useLayout ---
    const { setSidebarContent } = useLayout();

    // --- [All states unchanged] ---
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
    const [isRequestAccessModalOpen, setIsRequestAccessModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [confirmationState, setConfirmationState] = useState(null);
    const [isIncomingRoomJitModalOpen, setIsIncomingRoomJitModalOpen] = useState(false);
    const [isIncomingPeerJitModalOpen, setIsIncomingPeerJitModalOpen] = useState(false);
    
    const getInitialView = () => {
        if (!user) return { level: 'loading' };
        if (user.role === 'CTO' || user.role === 'ProductOwner') {
            return { level: 'products', product: null, client: null };
        }
        if (user.role === 'Administrator') {
            return { level: 'clients', product: { id: user.product_id, product_name: user.productName }, client: null };
        }
        return { level: 'rooms', product: null, client: null };
    };
    const [viewState, setViewState] = useState(getInitialView());

    // --- [Custom Hooks unchanged] ---
    const {
        isLoading,
        products,
        pendingProducts,
        incomingRoomRequests,
        outgoingRoomRequests,
        pendingUsers,
        incomingPeerRequests,
        outgoingPeerRequests,
        refreshData
    } = useDashboardData(setToast);

    const {
        editingProductId,
        editFormData,
        handleApproveProduct,
        handleEditClick,
        handleEditCancel,
        handleEditFormChange,
        handleEditSave
    } = useProductManagement(setToast, refreshData);

    // --- [Badge Counts - unchanged] ---
    const incomingRoomRequestsCount = incomingRoomRequests.filter(r => r.status === 'pending').length;
    const incomingPeerRequestsCount = (incomingPeerRequests.productRequests?.length || 0) + (incomingPeerRequests.clientRequests?.length || 0);
    const outgoingRoomRequestsCount = outgoingRoomRequests.filter(r => r.status === 'pending').length;
    const outgoingPeerRequestsCount = outgoingPeerRequests.filter(r => r.status === 'pending').length;

    // --- [MODIFIED] useEffect to set the CORRECT sidebar content (Action Buttons) ---
    useEffect(() => {
        const linkClass = "flex items-center w-full px-3 py-3 text-sm font-medium text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors duration-150";
        
        // This content is the action buttons, as you wanted.
        setSidebarContent(
            <div className="flex flex-col space-y-2">
                {/* --- User-specific button --- */}
                {user?.role === 'User' && (
                    <button onClick={() => setIsRequestAccessModalOpen(true)} className={linkClass}>
                        <FiPenTool className="mr-3 flex-shrink-0" size={18} />
                        <span className="truncate">Request Room Access</span>
                    </button>
                )}

                {/* --- Admin / Owner / CTO buttons --- */}
                {user?.role !== 'User' && (
                    <button onClick={() => setIsRoomModalOpen(true)} className={linkClass}>
                        <FiPlusSquare className="mr-3 flex-shrink-0" size={18} />
                        <span className="truncate">Create Room</span>
                    </button>
                )}

                {(user?.role === 'CTO' || user?.role === 'Administrator' || user?.role === 'ProductOwner') && (
                    <>
                        <button onClick={() => setIsUserManagementModalOpen(true)} className={linkClass}>
                            <FiUsers className="mr-3 flex-shrink-0" size={18} />
                            <span className="truncate">Manage Users</span>
                            {pendingUsers.length > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                                    {pendingUsers.length}
                                </span>
                            )}
                        </button>
                        
                        <button onClick={() => setIsIncomingRoomJitModalOpen(true)} className={linkClass}>
                            <FiBell className="mr-3 flex-shrink-0" size={18} /> {/* Corrected Icon */}
                            <span className="truncate">Room JIT</span>
                            {incomingRoomRequestsCount > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                                    {incomingRoomRequestsCount}
                                </span>
                            )}
                        </button>
                    </>
                )}

                {(user?.role === 'ProductOwner' || user?.role === 'Administrator') && (
                    <button onClick={() => setIsIncomingPeerJitModalOpen(true)} className={linkClass}>
                        <FiShare2 className="mr-3 flex-shrink-0" size={18} /> {/* Corrected Icon */}
                        <span className="truncate">Peer JIT</span>
                        {incomingPeerRequestsCount > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                                {incomingPeerRequestsCount}
                            </span>
                        )}
                    </button>
                )}
            </div>
        );
        // Clean up sidebar content when component unmounts
        return () => setSidebarContent(null);
    }, [
        setSidebarContent, 
        user, 
        pendingUsers.length, 
        incomingRoomRequestsCount, 
        incomingPeerRequestsCount,
        setIsRoomModalOpen,
        setIsRequestAccessModalOpen,
        setIsUserManagementModalOpen,
        setIsIncomingRoomJitModalOpen,
        setIsIncomingPeerJitModalOpen
    ]);


    // --- [All handler functions unchanged] ---
    const handleRejectProduct = (productId, productName) => {
        setConfirmationState({
            action: 'rejectProduct',
            product: { id: productId, name: productName },
            title: `Reject Product?`,
            message: `Are you sure you want to reject and delete the product "${productName}"? This action cannot be undone.`,
            confirmText: 'Reject & Delete',
            confirmVariant: 'danger'
        });
        setIsConfirmModalOpen(true);
    };
    const handleDeleteProduct = (productId, productName) => {
        setConfirmationState({
            action: 'deleteProduct',
            product: { id: productId, name: productName },
            title: `PERMANENTLY DELETE Product?`,
            message: `Are you sure you want to PERMANENTLY DELETE "${productName}"? This is a highly destructive action and will also delete all associated clients, rooms, and deactivate all users. This cannot be undone.`,
            confirmText: 'Yes, Delete This Product',
            confirmVariant: 'danger'
        });
        setIsConfirmModalOpen(true);
    };
    const onConfirmAction = async () => {
        if (!confirmationState) return;
        const { action, product } = confirmationState;
        const { id, name } = product;

        setIsConfirmingAction(true);
        try {
            if (action === 'rejectProduct') {
                await rejectProduct(id);
                setToast({ message: `Product "${name}" rejected and deleted.`, type: 'success' });
                refreshData();
            } else if (action === 'deleteProduct') {
                await deleteProduct(id);
                setToast({ message: `Product "${name}" has been permanently deleted.`, type: 'success' });
                refreshData();
            }
            handleCloseConfirmModal();
        } catch (err) {
            setToast({ message: err.response?.data?.message || `Failed to ${action} product.`, type: 'error' });
        } finally {
            setIsConfirmingAction(false);
        }
    };
    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setTimeout(() => setConfirmationState(null), 300);
    };
    const handleProductSelect = (product) => {
        setViewState({ level: 'clients', product: product, client: null });
    };
    const handleClientSelect = (client) => {
        setViewState({ level: 'rooms', product: viewState.product, client: client });
    };
    const handleGoBack = () => {
        if (viewState.level === 'rooms') {
            setViewState({ level: 'clients', product: viewState.product, client: null });
        } else if (viewState.level === 'clients' && (user.role === 'CTO' || user.role === 'ProductOwner')) {
            setViewState({ level: 'products', product: null, client: null });
        }
    };
    const onRoomCreated = () => {
        refreshData();
        setViewState(getInitialView());
        setToast({ message: 'Room created successfully!', type: 'success' });
    };
    const onUserManagementUpdate = (toastMessage) => {
        setToast(toastMessage);
    };
    const onIncomingRequestUpdate = (toastMessage) => {
        setToast(toastMessage);
        refreshData();
    };
    const onRequestAccessUpdate = (toastMessage) => {
        setToast(toastMessage);
        refreshData();
    };
    const onPeerRequestUpdate = (toastMessage) => {
        setToast(toastMessage);
        refreshData();
    };

    // --- [renderBrowseContent function unchanged] ---
    const renderBrowseContent = () => {
        if (!user) return <LoadingSpinner />;
        const { role } = user;
        if (role === 'User') {
            return <RoomCardsSection
                user={user}
                setToast={setToast}
                refreshData={refreshData}
            />;
        }
        if (role === 'Administrator') {
            if (viewState.level === 'clients') {
                return <ClientCardsSection
                    product={viewState.product}
                    onClientSelect={handleClientSelect}
                    user={user}
                    setToast={setToast}
                />;
            }
            if (viewState.level === 'rooms') {
                return <RoomCardsSection
                    client={viewState.client}
                    onBack={handleGoBack}
                    user={user}
                    setToast={setToast}
                    refreshData={refreshData}
                />;
            }
        }
        if (role === 'CTO' || role === 'ProductOwner') {
            if (viewState.level === 'products') {
                return <ProductCardsSection
                    products={products}
                    onProductSelect={handleProductSelect}
                    user={user}
                    setToast={setToast}
                />;
            }
            if (viewState.level === 'clients') {
                return <ClientCardsSection
                    product={viewState.product}
                    onClientSelect={handleClientSelect}
                    onBack={handleGoBack}
                    user={user}
                    setToast={setToast}
                />;
            }
            if (viewState.level === 'rooms') {
                return <RoomCardsSection
                    client={viewState.client}
                    onBack={handleGoBack}
                    user={user}
                    setToast={setToast}
                    refreshData={refreshData}
                />;
            }
        }
        return <LoadingSpinner />;
    };

    return (
        // --- [MODIFIED] Added padding to main div ---
        // `pl-16` provides space for the hamburger button on mobile
        // `pr-4 sm:pr-6 lg:pr-8` is standard padding for the right
        // `pt-4 sm:pt-6 lg:pt-8` is standard padding for the top
        <div className="p-4 sm:p-6 lg:p-8 pl-16"> 
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* --- [Modals - unchanged] --- */}
            <AnimatePresence>
                {isRoomModalOpen && (
                    <CreateRoomModal
                        isOpen={isRoomModalOpen}
                        onClose={() => setIsRoomModalOpen(false)}
                        onSuccess={onRoomCreated}
                        backdropVariants={modalBackdropVariants}
                        modalVariants={modalContentVariants}
                    />
                )}
                
                {isUserManagementModalOpen && (
                    <UserManagementModal
                        isOpen={isUserManagementModalOpen}
                        onClose={() => setIsUserManagementModalOpen(false)}
                        userRole={user?.role}
                        onUpdate={onUserManagementUpdate}
                    />
                )}

                {isIncomingRoomJitModalOpen && (
                    <IncomingJitModal
                        isOpen={isIncomingRoomJitModalOpen}
                        onClose={() => setIsIncomingRoomJitModalOpen(false)}
                        onUpdate={onIncomingRequestUpdate}
                        requests={incomingRoomRequests}
                        refreshRequests={refreshData}
                        api={{ approveRoomRequest, rejectRoomRequest, revokeRequest }}
                        backdropVariants={modalBackdropVariants}
                        modalVariants={modalContentVariants}
                    />
                )}
                
                {isIncomingPeerJitModalOpen && (
                    <IncomingPeerJitModal
                        isOpen={isIncomingPeerJitModalOpen}
                        onClose={() => setIsIncomingPeerJitModalOpen(false)}
                        onUpdate={onPeerRequestUpdate}
                        api={{ getIncomingPeerRequests, respondToPeerRequest }}
                        backdropVariants={modalBackdropVariants}
                        modalVariants={modalContentVariants}
                    />
                )}

                {isRequestAccessModalOpen && (
                    <RequestAccessModal
                        isOpen={isRequestAccessModalOpen}
                        onClose={() => setIsRequestAccessModalOpen(false)}
                        onSuccess={onRequestAccessUpdate}
                        api={{ requestAccess, editRequest }}
                        backdropVariants={modalBackdropVariants}
                        modalVariants={modalContentVariants}
                    />
                )}

                {isConfirmModalOpen && (
                    <ConfirmModal
                        isOpen={isConfirmModalOpen}
                        onClose={handleCloseConfirmModal}
                        onConfirm={onConfirmAction}
                        isConfirming={isConfirmingAction}
                        title={confirmationState?.title || "Are you sure?"}
                        message={confirmationState?.message || ""}
                        confirmText={confirmationState?.confirmText || "Confirm"}
                        confirmVariant={confirmationState?.confirmVariant || "danger"}
                    />
                )}
            </AnimatePresence>
            
            <div className="max-w-7xl mx-auto">
                
                {/* --- [MODIFIED] DashboardHeader no longer gets ANY button props --- */}
                {/* This requires you to have updated DashboardHeader.js */}
                <DashboardHeader
                    user={user}
                />
                
                {/* --- [CTO sections - unchanged] --- */}
                {!isLoading && user?.role === 'CTO' && (
                    <>
                        <PendingProductsSection
                            pendingProducts={pendingProducts}
                            onApprove={handleApproveProduct}
                            onReject={handleRejectProduct}
                        />
                        <ManageProductsSection
                            allProducts={products}
                            editingProductId={editingProductId}
                            editFormData={editFormData}
                            onEditClick={handleEditClick}
                            onEditCancel={handleEditCancel}
                            onEditChange={handleEditFormChange}
                            onEditSave={handleEditSave}
                            onDeleteProduct={handleDeleteProduct}
                        />
                    </>
                )}
                
                {/* --- [RESTORED] Tabs are back in the main content area --- */}
                {!isLoading && user && (
                    <DashboardTabs
                        currentTab={currentTab}
                        setCurrentTab={setCurrentTab}
                        browseTabName={user.role === 'User' ? 'My Rooms' : 'Browse'}
                        outgoingRoomRequestCount={outgoingRoomRequestsCount}
                        outgoingPeerRequestCount={outgoingPeerRequestsCount}
                        showPeerJitTab={user.role === 'ProductOwner' || user.role === 'Administrator'}
                        userRole={user.role}
                    />
                )}
                
                {/* --- [Tab Content - unchanged] --- */}
                <AnimatePresence mode='wait'>
                    {isLoading ? (
                        <motion.div
                            key="loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-center items-center h-64"
                        >
                            <LoadingSpinner />
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`${currentTab}-${viewState.level}-${viewState.product?.id}-${viewState.client?.id}`}
                            variants={tabContentVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            {currentTab === 'browse' && renderBrowseContent()}
                            {currentTab === 'outgoing_room' && <OutgoingRequestsSection outgoingRequests={outgoingRoomRequests} setToast={setToast} />}
                            {currentTab === 'outgoing_peer' && <OutgoingPeerRequestsSection outgoingRequests={outgoingPeerRequests} userRole={user.role} setToast={setToast} api={{ getOutgoingPeerRequests }} />}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default Dashboard;