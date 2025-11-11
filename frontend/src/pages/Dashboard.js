// frontend/src/pages/Dashboard.js

import React, { useState } from 'react';
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
import Sidebar from '../components/Sidebar'; 
import ThemeToggleButton from '../components/ThemeToggleButton'; 
import Toast from '../Toast';
import LoadingSpinner from '../components/LoadingSpinner';

// New Refactored Imports
import { useDashboardData } from '../components/dashboard/hooks/useDashboardData';
import { useProductManagement } from '../components/dashboard/hooks/useProductManagement';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardTabs from '../components/dashboard/DashboardTabs';
import PendingProductsSection from '../components/dashboard/sections/PendingProductsSection';
import ManageProductsSection from '../components/dashboard/sections/ManageProductsSection';

// --- [BLOCK 6] Import new hierarchical components ---
import ProductCardsSection from '../components/dashboard/sections/ProductCardsSection';
import ClientCardsSection from '../components/dashboard/sections/ClientCardsSection';
import RoomCardsSection from '../components/dashboard/sections/RoomCardsSection';

// --- [BUG_FIX] Clarified ALL imports ---
import OutgoingRequestsSection from '../components/dashboard/sections/OutgoingRequestsSection'; // For Rooms
import OutgoingPeerRequestsSection from '../components/dashboard/sections/OutgoingPeerRequestsSection'; // For Products/Clients

// Modals
import UserManagementModal from '../components/modals/UserManagementModal';
import CreateRoomModal from '../components/modals/CreateRoomModal';
import IncomingJitModal from '../components/modals/IncomingJitModal'; // For Rooms
import IncomingPeerJitModal from '../components/modals/IncomingPeerJitModal'; // For Products/Clients
import RequestAccessModal from '../components/modals/RequestAccessModal';
import ConfirmModal from '../components/modals/ConfirmModal';
// --- [END BUG_FIX] ---


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

    // Modal States
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
    const [isRequestAccessModalOpen, setIsRequestAccessModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [confirmationState, setConfirmationState] = useState(null); 
    
    const [isIncomingRoomJitModalOpen, setIsIncomingRoomJitModalOpen] = useState(false);
    const [isIncomingPeerJitModalOpen, setIsIncomingPeerJitModalOpen] = useState(false);


    // --- [BLOCK 6] New state for hierarchical view ---
    const getInitialView = () => {
        if (!user) return { level: 'loading' }; // Handle initial load
        if (user.role === 'CTO' || user.role === 'ProductOwner') {
            return { level: 'products', product: null, client: null };
        }
        if (user.role === 'Administrator') {
            return { level: 'clients', product: { id: user.product_id, product_name: user.productName }, client: null };
        }
        return { level: 'rooms', product: null, client: null };
    };
    const [viewState, setViewState] = useState(getInitialView());
    // --- [END BLOCK 6] ---

    // Custom Hooks
    const {
        isLoading,
        products,
        pendingProducts,
        // --- [BADGE_FIX] Use new state names ---
        incomingRoomRequests,
        outgoingRoomRequests,
        pendingUsers,
        incomingPeerRequests,
        outgoingPeerRequests,
        // --- [END BADGE_FIX] ---
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

    const handleRejectProduct = (productId, productName) => {
        console.log(`[DASHBOARD_LOG] [BLOCK_4] Staging REJECT_PRODUCT action for product ${productId}`);
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
        console.log(`[DASHBOARD_LOG] Staging DELETE_PRODUCT action for product ${productId}`);
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
        console.log(`[DASHBOARD_LOG] Executing confirmed action '${action}' for product ${id}`);

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
            console.error(`[DASHBOARD_LOG] Error during confirmed action '${action}' for product ${id}:`, err);
            setToast({ message: err.response?.data?.message || `Failed to ${action} product.`, type: 'error' });
        } finally {
            setIsConfirmingAction(false); 
        }
    };

    const handleCloseConfirmModal = () => {
        console.log('[DASHBOARD_LOG] [BLOCK_4] Closing confirmation modal.');
        setIsConfirmModalOpen(false);
        setTimeout(() => {
            setConfirmationState(null);
        }, 300);
    };

    // --- [BLOCK 6] New Handlers for view navigation ---
    const handleProductSelect = (product) => {
        console.log(`[Dashboard] Product selected:`, product.product_name);
        setViewState({ level: 'clients', product: product, client: null });
    };
    
    const handleClientSelect = (client) => {
        console.log(`[Dashboard] Client selected:`, client.name);
        setViewState({ level: 'rooms', product: viewState.product, client: client });
    };

    const handleGoBack = () => {
        if (viewState.level === 'rooms') {
            console.log(`[Dashboard] Going back to clients`);
            setViewState({ level: 'clients', product: viewState.product, client: null });
        } else if (viewState.level === 'clients' && (user.role === 'CTO' || user.role === 'ProductOwner')) {
            console.log(`[Dashboard] Going back to products`);
            setViewState({ level: 'products', product: null, client: null });
        }
    };
    // --- [END BLOCK 6] ---

    // Callbacks for Modals
    const onRoomCreated = () => {
         console.log('[DASHBOARD_LOG] onRoomCreated callback triggered.');
         refreshData(); 
         setViewState(getInitialView());
         setToast({ message: 'Room created successfully!', type: 'success' });
    }

    const onUserManagementUpdate = (toastMessage) => {
         console.log('[DASHBOARD_LOG] onUserManagementUpdate callback triggered.');
         setToast(toastMessage);
    };

    const onIncomingRequestUpdate = (toastMessage) => {
        console.log('[DASHBOARD_LOG] [JIT_FIX] onIncomingRequestUpdate callback triggered.');
        setToast(toastMessage);
        refreshData(); 
    };

    const onRequestAccessUpdate = (toastMessage) => {
        console.log('[DASHBOARD_LOG] [JIT_FIX] onRequestAccessUpdate callback triggered.');
        setToast(toastMessage);
        refreshData(); 
    };
    
    const onPeerRequestUpdate = (toastMessage) => {
        console.log('[DASHBOARD_LOG] [BLOCK_6] onPeerRequestUpdate callback triggered.');
        setToast(toastMessage);
        refreshData();
    };

    // --- [BLOCK 6] New render function for browse content ---
    const renderBrowseContent = () => {
        if (!user) return <LoadingSpinner />; // Guard against user being null on init
        
        const { role } = user;
        
        // --- USERS ---
        if (role === 'User') {
            return <RoomCardsSection 
                        user={user} 
                        setToast={setToast} 
                        refreshData={refreshData} 
                    />;
        }

        // --- ADMINS ---
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

        // --- CTO & POs ---
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

    // --- [BADGE_FIX] 2. Calculate all counts ---
    const incomingRoomRequestsCount = incomingRoomRequests.filter(r => r.status === 'pending').length;
    const incomingPeerRequestsCount = (incomingPeerRequests.productRequests?.length || 0) + (incomingPeerRequests.clientRequests?.length || 0);
    const outgoingRoomRequestsCount = outgoingRoomRequests.filter(r => r.status === 'pending').length;
    const outgoingPeerRequestsCount = outgoingPeerRequests.filter(r => r.status === 'pending').length;
    // --- [END BADGE_FIX] ---

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Sidebar 
                handleNewChat={() => {}} 
                conversations={[]}       
                onSelectConversation={() => {}} 
            />

            {/* --- Modals --- */}
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
                        requests={incomingRoomRequests} // --- [BADGE_FIX] Use correct state
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
            
            <main className="flex-grow overflow-y-auto p-6 lg:p-12 relative">
                
                <header className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggleButton />
                </header>
                
                <div className="max-w-7xl mx-auto pt-10">
                    
                    {/* --- [BADGE_FIX] 3. Pass all new counts to header --- */}
                    <DashboardHeader
                        user={user}
                        incomingRequestsCount={incomingRoomRequestsCount}
                        pendingUsersCount={pendingUsers.length}
                        incomingPeerRequestsCount={incomingPeerRequestsCount}
                        onRequestAccessModalOpen={() => setIsRequestAccessModalOpen(true)}
                        onIncomingJitModalOpen={() => setIsIncomingRoomJitModalOpen(true)}
                        onUserManagementModalOpen={() => setIsUserManagementModalOpen(true)}
                        onCreateRoomModalOpen={() => setIsRoomModalOpen(true)}
                        onIncomingPeerJitModalOpen={() => setIsIncomingPeerJitModalOpen(true)}
                    />
                    
                    {/* Render CTO-only sections */}
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
                    
                    {/* Tabs for Room and Request lists */}
                    {!isLoading && user && ( 
                        <DashboardTabs
                            currentTab={currentTab}
                            setCurrentTab={setCurrentTab}
                            browseTabName={user.role === 'User' ? 'My Rooms' : 'Browse'}
                            // --- [BADGE_FIX] 4. Pass correct counts to tabs ---
                            outgoingRoomRequestCount={outgoingRoomRequestsCount}
                            outgoingPeerRequestCount={outgoingPeerRequestsCount}
                            showPeerJitTab={user.role === 'ProductOwner' || user.role === 'Administrator'}
                            userRole={user.role}
                        />
                    )}
                    
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
                                {/* --- [BADGE_FIX] 5. Pass correct data to components --- */}
                                {currentTab === 'outgoing_room' && <OutgoingRequestsSection outgoingRequests={outgoingRoomRequests} setToast={setToast} />}
                                {currentTab === 'outgoing_peer' && <OutgoingPeerRequestsSection outgoingRequests={outgoingPeerRequests} userRole={user.role} setToast={setToast} api={{ getOutgoingPeerRequests }} />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;