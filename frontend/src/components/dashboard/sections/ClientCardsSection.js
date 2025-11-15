// frontend/src/components/dashboard/sections/ClientCardsSection.js

import React, { useState, useEffect, useCallback } from 'react';
// [FIX 1] Import 'isConnected' from the useSocket hook
import { useSocket } from '../../../context/SocketContext';
import { getClientsForProduct } from '../../../services/api';
import { FiLock, FiChevronRight, FiAlertTriangle, FiArrowLeft, FiClock } from 'react-icons/fi';
import LoadingSpinner from '../../LoadingSpinner';

// Import the new modal
import PeerRequestModal from '../../modals/PeerRequestModal'; 

// Copied helper function for JIT timer
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


const ClientCardsSection = ({ product, onClientSelect, onBack, user, setToast }) => {
    // [FIX 1] Destructure 'socket' AND 'isConnected'
    const { socket, isConnected } = useSocket();
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jitTimes, setJitTimes] = useState({});

    const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
    const [selectedPeerResource, setSelectedPeerResource] = useState(null); 

    const fetchClients = useCallback(async () => {
            if (!user || !product?.id) return;
            
            console.log(`[ClientCardsSection] Fetching clients for product ID: ${product.id}`);
            setIsLoading(true);
            setError(null);
    
            try {
                const response = await getClientsForProduct(product.id);
                console.log('[ClientCardsSection] Clients processed with access levels:', response.data);
                setClients(response.data);
    
            } catch (err) {
                console.error('[ClientCardsSection] Error fetching clients:', err);
                setError('Failed to load clients.');
                setToast({ message: err.response?.data?.message || 'Failed to load clients.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [user, product, setToast]); 

    // Initial data fetch
    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    // Socket.io listener
    useEffect(() => {
        // [FIX 2] Add 'isConnected' to the guard clause
        if (socket && isConnected) {
            const handleRefresh = (data) => {
                console.log("[ClientCardsSection] [SOCKET] Received HIERARCHY_UPDATED or CLIENT_LIST_UPDATED. Refreshing clients.");
                fetchClients();
            };
            
            socket.on('HIERARCHY_UPDATED', handleRefresh);
            socket.on('CLIENT_LIST_UPDATED', handleRefresh); // For when PO assigns/unassigns

            return () => {
                socket.off('HIERARCHY_UPDATED', handleRefresh);
                socket.off('CLIENT_LIST_UPDATED', handleRefresh);
            };
        }
    // [FIX 3] Add 'isConnected' to the dependency array
    }, [socket, isConnected, fetchClients]);

    // JIT Timer Effect
    useEffect(() => {
        const timer = setInterval(() => {
            const newTimes = {};
            let needsRefresh = false;
            
            clients.forEach(client => {
                if (client.expires_at) {
                    const { text, expired } = calculateTimeLeft(client.expires_at);
                    if (expired) {
                        needsRefresh = true;
                    } else {
                        newTimes[client.id] = text;
                    }
                }
            });
            setJitTimes(newTimes);
            if (needsRefresh) {
                console.log("[ClientCardsSection] JIT timer expired for one or more clients. Refreshing data.");
                fetchClients(); 
            }
        }, 1000); 

        return () => clearInterval(timer);
    }, [clients, fetchClients]); 

    const handleCardClick = (client) => {
        if (client.accessLevel === 'full') {
            onClientSelect(client);
        } else {
            console.log(`[ClientCardsSection] Opening Peer JIT modal for client:`, client.name);
            setSelectedPeerResource({ type: 'client', resource: client });
            setIsPeerModalOpen(true);
        }
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
            <div className="flex items-center mb-6">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        <FiArrowLeft size={16} />
                        Back to Products
                    </button>
                )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Clients for <span className="text-blue-600 dark:text-blue-400">{product.product_name}</span>
            </h2>

            {clients.length === 0 ? (
                 <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                     <p>No clients have been created for this product yet.</p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map((client) => (
                        <div 
                            key={client.id}
                            onClick={() => handleCardClick(client)}
                            className={`
                                relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform 
                                transition-all duration-300 ease-in-out group
                                ${client.accessLevel === 'full' 
                                    ? 'hover:scale-[1.03] hover:shadow-2xl cursor-pointer' 
                                    : 'opacity-60 cursor-pointer' // Allow clicking locked card
                                }
                            `}
                        >
                            {/* JIT Timer Badge */}
                            {jitTimes[client.id] && (
                                <div 
                                    className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-bold px-2 py-1 rounded-full shadow-lg"
                                    title={`JIT Access expires at ${new Date(client.expires_at).toLocaleString()}`}
                                >
                                    <FiClock size={12} />
                                    <span>{jitTimes[client.id]}</span>
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate" title={client.name}>
                                        {client.name}
                                    </h3>
                                    {client.accessLevel === 'locked' && (
                                        <FiLock className="text-gray-400" title="Access Locked" />
                                    )}
                                    {client.accessLevel === 'full' && (
                                        <FiChevronRight className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                    )}
                                </div>
                                
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 truncate">
                                    Client ID: {client.id}
                                </p>

                                {client.accessLevel === 'locked' && (
                                    <button 
                                        className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 transition-colors duration-200"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCardClick(client);
                                        }}
                                    >
                                        <FiLock size={14} />
                                        Request Access
                                    </button>
                                )}
                                {client.accessLevel === 'full' && (
                                    <button 
                                        className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group-hover:bg-blue-700 transition-colors duration-200"
                                    >
                                        <FiChevronRight size={14} />
                                        View Rooms
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPeerResource && (
                <PeerRequestModal
                    isOpen={isPeerModalOpen}
                    onClose={() => setIsPeerModalOpen(false)}
                    resourceType={selectedPeerResource.type}
                    resource={selectedPeerResource.resource}
                    setToast={setToast}
                />
            )}
        </>
    );
};

export default ClientCardsSection;