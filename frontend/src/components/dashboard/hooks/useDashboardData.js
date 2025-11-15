// frontend/src/components/dashboard/hooks/useDashboardData.js

import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import {
    getPendingProducts,
    getAllProducts,
    getIncomingRequests, 
    getOutgoingRequests, 
    getPendingUsers,
    getIncomingPeerRequests,
    getOutgoingPeerRequests 
} from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
// [FIX 1] Import both 'socket' and 'isConnected' from the context
import { useSocket } from '../../../context/SocketContext';

export const useDashboardData = (setToast) => {
    const { user } = useAuth();
    // [FIX 1] Destructure 'socket' and 'isConnected'
    const { socket, isConnected } = useSocket(); 
    
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [pendingProducts, setPendingProducts] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    
    const [incomingRoomRequests, setIncomingRoomRequests] = useState([]);
    const [outgoingRoomRequests, setOutgoingRoomRequests] = useState([]);
    const [incomingPeerRequests, setIncomingPeerRequests] = useState({ productRequests: [], clientRequests: [] });
    const [outgoingPeerRequests, setOutgoingPeerRequests] = useState([]); 


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
            const [
                outgoingRoomReqData,
                pendingProdData,
                productsData, 
                incomingRoomReqData,
                pendingUsersData,
                incomingPeerReqData,
                outgoingPeerReqData 
            ] = results;

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
    }, [user, setToast]); 

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]); 

    const refreshData = useCallback(() => {
        console.log('[useDashboardData] Manual or Socket refresh triggered.');
        loadDashboardData();
    }, [loadDashboardData]);

    useEffect(() => {
        // [FIX 2] Use the 'isConnected' flag as the guard.
        // This ensures the socket is fully connected and has '.on'
        if (socket && isConnected) {
            console.log('[useDashboardData] [SOCKET] Setting up socket listeners...');
            
            const handleDataUpdate = (eventType) => {
                console.log(`[useDashboardData] [SOCKET] Received event: ${eventType}. Refreshing data...`);
                refreshData();
            };

            const handleProductUpdate = () => handleDataUpdate('PRODUCT_LIST_UPDATED');
            const handleUserUpdate = () => handleDataUpdate('USER_LIST_UPDATED');
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
    // [FIX 3] Add 'isConnected' to the dependency array
    }, [socket, isConnected, refreshData]);

    return {
        isLoading,
        products, 
        pendingProducts,
        incomingRoomRequests, 
        outgoingRoomRequests, 
        pendingUsers, 
        incomingPeerRequests,
        outgoingPeerRequests, 
        refreshData 
    };
};