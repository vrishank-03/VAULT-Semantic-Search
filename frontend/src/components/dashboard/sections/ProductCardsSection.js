// frontend/src/components/dashboard/sections/ProductCardsSection.js

import React, { useState, useMemo } from 'react'; // --- [BUG_FIX] Removed useEffect, useCallback. Added useMemo ---
// --- [BUG_FIX] Removed useAuth, useSocket, getAllProducts ---
import { FiLock, FiChevronRight, FiAlertTriangle } from 'react-icons/fi';
// --- [BUG_FIX] Removed LoadingSpinner ---

// --- [BLOCK 6] Import PeerRequestModal ---
import PeerRequestModal from '../../modals/PeerRequestModal'; 

// --- [BUG_FIX] Changed props: receiving `products` prop now ---
const ProductCardsSection = ({ products, onProductSelect, user, setToast }) => {
    
    // --- [BUG_FIX] All internal loading, error, and product states are REMOVED ---
    // The `useDashboardData` hook now manages this.

    // --- [BLOCK 6] State for Peer JIT Modal ---
    const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
    const [selectedPeerResource, setSelectedPeerResource] = useState(null); // { type: 'product', resource: product }
    
    // --- [BUG_FIX] Converted data fetching into a memoized calculation based on props ---
    const productsWithAccess = useMemo(() => {
        if (!user || !products) return [];

        console.log('[ProductCardsSection] Memo: Recalculating product access levels...');
        return products.map(product => {
            if (user.role === 'CTO') {
                return { ...product, accessLevel: 'full', expires_at: null };
            }
            if (user.role === 'ProductOwner') {
                if (product.id === user.product_id) {
                    return { ...product, accessLevel: 'full', expires_at: null };
                }
                // TODO: Check for JIT access here
                return { ...product, accessLevel: 'locked', expires_at: null };
            }
            if (user.role === 'Administrator') {
                 if (product.id === user.product_id) {
                    return { ...product, accessLevel: 'full', expires_at: null };
                 }
                 return null;
            }
            return null;
        }).filter(Boolean); // Filter out nulls
    }, [products, user]); // Re-run only when products or user changes
    // --- [END BUG_FIX] ---

    // --- [BUG_FIX] Removed fetchProducts and socket useEffect ---

    const handleCardClick = (product) => {
        if (product.accessLevel === 'full') {
            onProductSelect(product);
        } else {
            // --- [BLOCK 6] This is a locked card. Open the Peer JIT modal. ---
            console.log(`[ProductCardsSection] Opening Peer JIT modal for product:`, product.product_name);
            setSelectedPeerResource({ type: 'product', resource: product });
            setIsPeerModalOpen(true);
        }
    };
    
    // --- [BUG_FIX] Removed internal isLoading and error checks ---
    // The parent `Dashboard.js` now handles this.

    if (productsWithAccess.length === 0) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                <p>No products found.</p>
                {user.role === 'CTO' && (
                    <p className="mt-2">You can manage product requests in the sections above.</p>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {productsWithAccess.map((product) => (
                    <div 
                        key={product.id}
                        onClick={() => handleCardClick(product)}
                        className={`
                            bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform 
                            transition-all duration-300 ease-in-out group
                            ${product.accessLevel === 'full' 
                                ? 'hover:scale-[1.03] hover:shadow-2xl cursor-pointer' 
                                : 'opacity-60' // Removed cursor-not-allowed
                            }
                        `}
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate" title={product.product_name}>
                                    {product.product_name}
                                </h3>
                                {product.accessLevel === 'locked' && (
                                    <FiLock className="text-gray-400" title="Access Locked" />
                                )}
                                {product.accessLevel === 'full' && (
                                    <FiChevronRight className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                )}
                            </div>
                            
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 truncate" title={product.product_owner_email}>
                                <span className="font-medium">Owner:</span> {product.product_owner_name}
                            </p>

                            {product.accessLevel === 'locked' && (
                                <button 
                                    className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 transition-colors duration-200"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCardClick(product);
                                    }}
                                >
                                    <FiLock size={14} />
                                    Request Access
                                </button>
                            )}
                            {product.accessLevel === 'full' && (
                                 <button 
                                    className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group-hover:bg-blue-700 transition-colors duration-200"
                                >
                                    <FiChevronRight size={14} />
                                    View Clients
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* --- [BLOCK 6] Render the Peer JIT modal --- */}
            {selectedPeerResource && (
                <PeerRequestModal
                    isOpen={isPeerModalOpen}
                    onClose={() => setIsPeerModalOpen(false)}
                    resourceType={selectedPeerResource.type}
                    resource={selectedPeerResource.resource}
                    setToast={setToast} // <-- Pass setToast here
                />
            )}
            {/* --- [END BLOCK 6] --- */}
        </>
    );
};

export default ProductCardsSection;