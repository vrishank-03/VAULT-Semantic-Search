// frontend/src/components/dashboard/hooks/useDashboardData.js
import { useState, useEffect, useCallback } from 'react';
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
import { useSocket } from '../../../context/SocketContext';

export const useDashboardData = (setToast) => {
    const { user } = useAuth();
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
        if (!user) return;

        setIsLoading(true);
        const isManager = ['CTO', 'ProductOwner', 'Administrator'].includes(user.role);
        const isPeerManager = ['ProductOwner', 'Administrator'].includes(user.role);

        // [CRITICAL FIX] Only fetch what the user is allowed to see
        const fetchesToRun = {
            outgoingRoomRequests: getOutgoingRequests(),
            pendingProducts: user.role === 'CTO' ? getPendingProducts() : Promise.resolve({ data: [] }),
            products: isManager ? getAllProducts() : Promise.resolve({ data: [] }),
            incomingRoomRequests: isManager ? getIncomingRequests() : Promise.resolve({ data: [] }),
            pendingUsers: isPeerManager ? getPendingUsers() : Promise.resolve({ data: [] }),
            incomingPeerRequests: isPeerManager ? getIncomingPeerRequests() : Promise.resolve({ data: { productRequests: [], clientRequests: [] } }),
            outgoingPeerRequests: isPeerManager ? getOutgoingPeerRequests() : Promise.resolve({ data: [] }),
        };

        try {
            const results = await Promise.all(Object.values(fetchesToRun));
            const [outRoom, pendingProd, prods, inRoom, pendingUsr, inPeer, outPeer] = results;

            if (outRoom) setOutgoingRoomRequests(outRoom.data || []);
            if (pendingProd) setPendingProducts(pendingProd.data || []);
            if (prods) setProducts(prods.data || []);
            if (inRoom) setIncomingRoomRequests(inRoom.data || []);
            if (pendingUsr) setPendingUsers(pendingUsr.data || []);
            if (inPeer) setIncomingPeerRequests(inPeer.data || { productRequests: [], clientRequests: [] });
            if (outPeer) setOutgoingPeerRequests(outPeer.data || []);

        } catch (error) {
            console.error('[useDashboardData] Partial Load Error:', error);
            setToast({ message: 'Syncing dashboard...', type: 'info' });
        } finally {
            setIsLoading(false);
        }
    }, [user, setToast]);

    useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

    const refreshData = useCallback(() => { loadDashboardData(); }, [loadDashboardData]);

    useEffect(() => {
        if (socket && isConnected) {
            const handleUpdate = () => refreshData();
            socket.on('PRODUCT_LIST_UPDATED', handleUpdate);
            socket.on('USER_LIST_UPDATED', handleUpdate);
            socket.on('JIT_REQUEST_UPDATED', handleUpdate);
            socket.on('ROOM_LIST_UPDATED', handleUpdate);
            socket.on('HIERARCHY_UPDATED', handleUpdate);
            socket.on('PEER_JIT_UPDATED', handleUpdate);

            return () => {
                socket.off('PRODUCT_LIST_UPDATED', handleUpdate);
                socket.off('USER_LIST_UPDATED', handleUpdate);
                socket.off('JIT_REQUEST_UPDATED', handleUpdate);
                socket.off('ROOM_LIST_UPDATED', handleUpdate);
                socket.off('HIERARCHY_UPDATED', handleUpdate);
                socket.off('PEER_JIT_UPDATED', handleUpdate);
            };
        }
    }, [socket, isConnected, refreshData]);

    return { isLoading, products, pendingProducts, incomingRoomRequests, outgoingRoomRequests, pendingUsers, incomingPeerRequests, outgoingPeerRequests, refreshData };
};