// frontend/src/components/dashboard/sections/OutgoingPeerRequestsSection.js

import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { getOutgoingPeerRequests } from '../../../services/api';
import { FiAlertTriangle, FiPackage, FiGift, FiClock, FiCheck, FiX, FiMinusCircle } from 'react-icons/fi';
import LoadingSpinner from '../../LoadingSpinner';

// Helper function for JIT timer
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

// Helper to format duration seconds
const formatDuration = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return 'Permanent';
    if (totalSeconds === 0) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds > 0 ? `${seconds}s` : ''}`.trim();
};

const OutgoingPeerRequestsSection = ({ userRole, setToast }) => {
    const socket = useSocket();
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jitTimes, setJitTimes] = useState({});

    const fetchRequests = useCallback(async () => {
        console.log('[OutgoingPeerRequests] Fetching outgoing peer requests...');
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await getOutgoingPeerRequests();
            console.log('[OutgoingPeerRequests] Fetched requests:', data);
            setRequests(data);
        } catch (err) {
            console.error('[OutgoingPeerRequests] Error fetching requests:', err);
            setError(err.response?.data?.message || 'Failed to load requests.');
            setToast({ message: err.response?.data?.message || 'Failed to load requests.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [setToast]);

    // Initial fetch
    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Socket.io listener
    useEffect(() => {
        if (socket) {
            const handleRefresh = (data) => {
                console.log("[OutgoingPeerRequests] [SOCKET] Received update. Refreshing requests.");
                fetchRequests();
            };
            
            socket.on('PEER_JIT_UPDATED', handleRefresh);
            socket.on('HIERARCHY_UPDATED', handleRefresh);

            return () => {
                socket.off('PEER_JIT_UPDATED', handleRefresh);
                socket.off('HIERARCHY_UPDATED', handleRefresh);
            };
        }
    }, [socket, fetchRequests]);

    // JIT Timer Effect
    useEffect(() => {
        const timer = setInterval(() => {
            const newTimes = {};
            let needsRefresh = false;
            
            requests.forEach(req => {
                if (req.status === 'approved' && req.expires_at) {
                    const { text, expired } = calculateTimeLeft(req.expires_at);
                    if (expired) {
                        needsRefresh = true;
                    } else {
                        newTimes[req.id] = text;
                    }
                }
            });
            setJitTimes(newTimes);
            if (needsRefresh) {
                console.log("[OutgoingPeerRequests] JIT timer expired. Refreshing data.");
                fetchRequests(); 
            }
        }, 1000); 

        return () => clearInterval(timer);
    }, [requests, fetchRequests]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved':
                return <FiCheck size={16} className="text-green-500" />;
            case 'pending':
                return <FiClock size={16} className="text-yellow-500" />;
            case 'rejected':
                return <FiX size={16} className="text-red-500" />;
            case 'revoked':
            case 'expired':
                return <FiMinusCircle size={16} className="text-gray-500" />;
            default:
                return null;
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

    if (requests.length === 0) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                <p>You have not made any peer-to-peer access requests.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {requests.map((req) => (
                    <li key={`${req.type}-${req.id}`} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            {req.type === 'product' ? 
                                <FiPackage size={24} className="text-blue-500" /> : 
                                <FiGift size={24} className="text-indigo-500" />
                            }
                            <div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                                    {req.type}: {req.resource_name}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Owner: {req.owner_email}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Last updated: {new Date(req.updated_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex flex-col sm:items-end gap-2">
                            <div className="flex items-center gap-2">
                                <span className={`capitalize px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                                    req.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                    req.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : 
                                    'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                }`}>
                                    {getStatusIcon(req.status)}
                                    <span className="ml-1">{req.status}</span>
                                </span>
                            </div>
                            {req.status === 'approved' && (
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {jitTimes[req.id] ? (
                                        <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                            <FiClock size={14} /> {jitTimes[req.id]}
                                        </span>
                                    ) : (
                                        `Expires: ${req.expires_at ? new Date(req.expires_at).toLocaleString() : 'Never'}`
                                    )}
                                </span>
                            )}
                            {req.status === 'pending' && (
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Requested: {formatDuration(req.requested_duration_seconds)}
                                </span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default OutgoingPeerRequestsSection;