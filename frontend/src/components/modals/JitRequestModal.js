import React, { useState, useEffect } from 'react';
import {
    getPendingRoomRequests,
    approveRoomRequest,
    rejectRoomRequest
} from '../../services/api';
import { FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

const JitRequestModal = ({ isOpen, onClose, onUpdate }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState({}); // Store duration per request

    const fetchJitRequests = async () => {
        console.log('[JIT_MODAL] Fetching pending JIT requests...');
        setIsLoading(true);
        setError(null);
        try {
            const response = await getPendingRoomRequests();
            console.log('[JIT_MODAL] Fetched pending requests:', response.data);
            setRequests(response.data);
            // Initialize duration state for each request
            const initialDurations = {};
            response.data.forEach(req => {
                initialDurations[req.id] = '4h'; // Default to 4 hours
            });
            setSelectedDuration(initialDurations);
        } catch (err) {
            console.error('[JIT_MODAL] Error fetching requests:', err);
            setError(err.response?.data?.message || 'Failed to load pending requests.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchJitRequests();
        }
    }, [isOpen]);

    const handleApprove = async (requestId, email) => {
        const duration = selectedDuration[requestId] || '4h'; // Get duration for this specific request
        console.log(`[JIT_MODAL] Attempting to approve request ${requestId} for ${duration}`);
        try {
            await approveRoomRequest(requestId, duration);
            console.log(`[JIT_MODAL] Successfully approved request ${requestId}`);
            onUpdate({ message: `Access for ${email} approved for ${duration}.`, type: 'success' });
            fetchJitRequests(); // Refresh list
        } catch (err) {
            console.error(`[JIT_MODAL] Error approving request ${requestId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to approve request.', type: 'error' });
        }
    };

    const handleReject = async (requestId, email) => {
        console.log(`[JIT_MODAL] Attempting to REJECT request ${requestId}`);
        try {
            await rejectRoomRequest(requestId);
            console.log(`[JIT_MODAL] Successfully rejected request ${requestId}`);
            onUpdate({ message: `Access for ${email} rejected.`, type: 'success' });
            fetchJitRequests(); // Refresh list
        } catch (err) {
            console.error(`[JIT_MODAL] Error rejecting request ${requestId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to reject request.', type: 'error' });
        }
    };

    const handleDurationChange = (requestId, duration) => {
        setSelectedDuration(prev => ({ ...prev, [requestId]: duration }));
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-3xl p-8 space-y-4 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                    <FiX size={24} />
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">JIT Room Access Requests</h2>
                
                {error && <p className="text-center text-red-500">{error}</p>}
                
                <div className="max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <LoadingSpinner />
                        </div>
                    ) : requests.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-10">There are no pending room access requests.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Room</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Duration</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {requests.map(req => (
                                    <tr key={req.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white" title={req.requester_email}>{req.requester_email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" title={req.room_name}>{req.room_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <select 
                                                value={selectedDuration[req.id] || '4h'}
                                                onChange={(e) => handleDurationChange(req.id, e.target.value)}
                                                className="block w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            >
                                                <option value="4h">4 Hours</option>
                                                <option value="1d">1 Day</option>
                                                <option value="permanent">Permanent</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4">
                                            <button 
                                                onClick={() => handleApprove(req.id, req.requester_email)}
                                                className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                            >
                                                <FiCheck size={16} /> Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(req.id, req.requester_email)}
                                                className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                <FiAlertTriangle size={16} /> Reject
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JitRequestModal;