// frontend/src/components/dashboard/hooks/useDashboardData.js

import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import {
    getPendingProducts,
    getAllProducts,
    getIncomingRequests,     // Renamed to incomingRoomRequests
    getOutgoingRequests,     // Renamed to outgoingRoomRequests
    getPendingUsers,
    getIncomingPeerRequests,
    getOutgoingPeerRequests  // --- [BADGE_FIX] 1. Import outgoing peer requests ---
} from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';

export const useDashboardData = (setToast) => {
    const { user } = useAuth();
    const socket = useSocket(); 
    
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [pendingProducts, setPendingProducts] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    
    // --- [BADGE_FIX] 2. Rename JIT states for clarity ---
    const [incomingRoomRequests, setIncomingRoomRequests] = useState([]);
    const [outgoingRoomRequests, setOutgoingRoomRequests] = useState([]);
    const [incomingPeerRequests, setIncomingPeerRequests] = useState({ productRequests: [], clientRequests: [] });
    const [outgoingPeerRequests, setOutgoingPeerRequests] = useState([]); // --- [BADGE_FIX] 3. Add new state ---


    const loadDashboardData = useCallback(async () => {
        if (!user) {
            console.log('[useDashboardData] User not ready, skipping data load.');
            return;
        }
        
        console.log('[useDashboardData] [BLOCK_6] User loaded. Loading all dashboard data...');
        setIsLoading(true);

        const isManager = user.role === 'CTO' || user.role === 'ProductOwner' || user.role === 'Administrator';
        const isPeerManager = user.role === 'ProductOwner' || user.role === 'Administrator';

        const fetchesToRun = {
            // --- [BADGE_FIX] 4. Update fetch list with new names and new fetch ---
            outgoingRoomRequests: getOutgoingRequests(),
            pendingProducts: user.role === 'CTO' ? getPendingProducts() : Promise.resolve(null),
            products: getAllProducts(), 
            incomingRoomRequests: isManager ? getIncomingRequests() : Promise.resolve(null),
            pendingUsers: isPeerManager ? getPendingUsers() : Promise.resolve(null),
            incomingPeerRequests: isPeerManager ? getIncomingPeerRequests() : Promise.resolve(null),
            outgoingPeerRequests: isPeerManager ? getOutgoingPeerRequests() : Promise.resolve(null),
        };

        try {
            const results = await Promise.all(Object.values(fetchesToRun));
            // --- [BADGE_FIX] 5. Update destructuring ---
            const [
                outgoingRoomReqData,
                pendingProdData,
                productsData, 
                incomingRoomReqData,
                pendingUsersData,
                incomingPeerReqData,
                outgoingPeerReqData 
            ] = results;

            // --- [BADGE_FIX] 6. Update state setters ---
            if (outgoingRoomReqData) setOutgoingRoomRequests(outgoingRoomReqData.data);
            if (pendingProdData) setPendingProducts(pendingProdData.data);
            if (productsData) setProducts(productsData.data); 
            if (incomingRoomReqData) setIncomingRoomRequests(incomingRoomReqData.data);
            if (pendingUsersData) setPendingUsers(pendingUsersData.data);
            if (incomingPeerReqData) setIncomingPeerRequests(incomingPeerReqData.data); 
            if (outgoingPeerReqData) setOutgoingPeerRequests(outgoingPeerReqData.data);

            console.log('[useDashboardData] All dashboard data loaded.');

        } catch (error) {
            console.error('[useDashboardData] Error loading one or more dashboard data components:', error);
            setToast({ message: 'Could not load all dashboard data. Please refresh.', type: 'error' });
        } finally {
            setIsLoading(false);
            console.log('[useDashboardData] Finished all fetches, setting loading to false.');
        }
    }, [user, setToast]); // Add dependencies here

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]); 

    const refreshData = useCallback(() => {
        console.log('[useDashboardData] Manual or Socket refresh triggered.');
        loadDashboardData();
    }, [loadDashboardData]);

    useEffect(() => {
        if (socket) {
            console.log('[useDashboardData] [SOCKET] Setting up socket listeners...');
            
            const handleDataUpdate = (eventType) => {
                console.log(`[useDashboardData] [SOCKET] Received event: ${eventType}. Refreshing data...`);
                refreshData();
            };

            const handleProductUpdate = () => handleDataUpdate('PRODUCT_LIST_UPDATED');
            const handleUserUpdate = () => handleDataUpdate('USER_LIST_UPDATED');
            // --- [BADGE_FIX] 7. Rename socket handler for clarity ---
            const handleRoomJitUpdate = () => handleDataUpdate('JIT_REQUEST_UPDATED');
            const handleRoomUpdate = () => handleDataUpdate('ROOM_LIST_UPDATED');
            const handleHierarchyUpdate = () => handleDataUpdate('HIERARCHY_UPDATED');
            const handlePeerJitUpdate = () => handleDataUpdate('PEER_JIT_UPDATED');

            // Attach listeners
            socket.on('PRODUCT_LIST_UPDATED', handleProductUpdate);
            socket.on('USER_LIST_UPDATED', handleUserUpdate);
            socket.on('JIT_REQUEST_UPDATED', handleRoomJitUpdate); // For Room JIT
            socket.on('ROOM_LIST_UPDATED', handleRoomUpdate);
            socket.on('HIERARCHY_UPDATED', handleHierarchyUpdate); 
            socket.on('PEER_JIT_UPDATED', handlePeerJitUpdate); // For Peer JIT

            // Cleanup
            return () => {
                console.log('[useDashboardData] [SOCKET] Tearing down socket listeners...');
                
                socket.off('PRODUCT_LIST_UPDATED', handleProductUpdate);
                socket.off('USER_LIST_UPDATED', handleUserUpdate);
                socket.off('JIT_REQUEST_UPDATED', handleRoomJitUpdate);
                socket.off('ROOM_LIST_UPDATED', handleRoomUpdate);
                socket.off('HIERARCHY_UPDATED', handleHierarchyUpdate);
                socket.off('PEER_JIT_UPDATED', handlePeerJitUpdate);
            };
        } else {
            console.log('[useDashboardData] [SOCKET] Socket not ready, skipping listener setup.');
        }
    }, [socket, refreshData]);
    // --- [END BLOCK 4] ---

    return {
        isLoading,
        products, 
        pendingProducts,
        // --- [BADGE_FIX] 8. Return all new states with clear names ---
        incomingRoomRequests,   // Formerly incomingRequests
        outgoingRoomRequests,   // Formerly outgoingRequests
        pendingUsers, 
        incomingPeerRequests,
        outgoingPeerRequests,   // New
        refreshData 
    };
};