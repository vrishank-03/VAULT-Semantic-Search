// frontend/src/components/modals/IncomingJitModal.js

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertTriangle, FiClock, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';
// --- [BLOCK 4] NEW IMPORT ---
import ConfirmModal from './ConfirmModal';

// Helper component for the new duration inputs
const DurationInput = ({ duration, onChange }) => {
    const handlechange = (e) => {
        const { name, value } = e.target;
        if (/^[0-9]*$/.test(value)) {
            onChange({ ...duration, [name]: value });
        }
    };

    return (
        <div className="flex space-x-1">
            <input
                type="text"
                name="hours"
                value={duration.hours}
                onChange={handlechange}
                className="block w-14 px-2 py-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                placeholder="h"
            />
            <input
                type="text"
                name="minutes"
                value={duration.minutes}
                onChange={handlechange}
                className="block w-14 px-2 py-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                placeholder="m"
            />
            <input
                type="text"
                name="seconds"
                value={duration.seconds}
                onChange={handlechange}
                className="block w-14 px-2 py-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                placeholder="s"
            />
        </div>
    );
};

// Helper function to format seconds
const formatDuration = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return 'Permanent';
    if (totalSeconds === 0) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds > 0 ? `${seconds}s` : ''}`.trim();
};


const IncomingJitModal = ({ isOpen, onClose, onUpdate, requests, refreshRequests, api, backdropVariants, modalVariants }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [durations, setDurations] = useState({});

    // --- [BLOCK 4] New state for confirmation modal ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [confirmationState, setConfirmationState] = useState(null); // { request: {...} }

    useEffect(() => {
        if (isOpen && requests.length > 0) {
            const initialDurations = {};
            requests.forEach(req => {
                initialDurations[req.id] = { hours: '4', minutes: '0', seconds: '0' };
            });
            setDurations(initialDurations);
        }
    }, [isOpen, requests]);

    const handleDurationChange = (requestId, newDuration) => {
        setDurations(prev => ({ ...prev, [requestId]: newDuration }));
    };

    const handleApprove = async (request) => {
        const duration = durations[request.id] || { hours: '4', minutes: '0', seconds: '0' };
        console.log(`[JIT_MODAL] Attempting to approve request ${request.id} for`, duration);
        setIsLoading(true);
        try {
            await api.approveRoomRequest(request.id, duration);
            console.log(`[JIT_MODAL] Successfully approved request ${request.id}`);
            onUpdate({ message: `Access for ${request.requester_email} approved.`, type: 'success' });
            refreshRequests(); 
        } catch (err) {
            console.error(`[JIT_MODAL] Error approving request ${request.id}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to approve request.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async (request) => {
        console.log(`[JIT_MODAL] Attempting to REJECT request ${request.id}`);
        setIsLoading(true);
        try {
            await api.rejectRoomRequest(request.id);
            console.log(`[JIT_MODAL] Successfully rejected request ${request.id}`);
            onUpdate({ message: `Access for ${request.requester_email} rejected.`, type: 'success' });
            refreshRequests();
        } catch (err) {
            console.error(`[JIT_MODAL] Error rejecting request ${request.id}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to reject request.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- [BLOCK 4] REFACTORED to open modal ---
    const handleRevoke = (request) => {
        console.log(`[JIT_MODAL] [BLOCK_4] Staging REVOKE action for request ${request.id}`);
        setConfirmationState({ request });
        setIsConfirmModalOpen(true);
    };

    // --- [BLOCK 4] NEW HANDLER for modal confirm ---
    const onConfirmRevoke = async () => {
        if (!confirmationState) return;
        const { request } = confirmationState;

        console.log(`[JIT_MODAL] [BLOCK_4] Executing confirmed REVOKE for request ${request.id}`);
        setIsConfirmingAction(true);
        try {
            await api.revokeRequest(request.id);
            console.log(`[JIT_MODAL] Successfully revoked request ${request.id}`);
            onUpdate({ message: `Access for ${request.requester_email} revoked.`, type: 'success' });
            refreshRequests();
            handleCloseConfirmModal(); // Close on success
        } catch (err) {
            console.error(`[JIT_MODAL] Error revoking request ${request.id}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to revoke request.', type: 'error' });
        } finally {
            setIsConfirmingAction(false);
        }
    };

    // --- [BLOCK 4] NEW HANDLER for modal close ---
    const handleCloseConfirmModal = () => {
        console.log('[JIT_MODAL] [BLOCK_4] Closing confirmation modal.');
        setIsConfirmModalOpen(false);
        setTimeout(() => {
            setConfirmationState(null);
        }, 300);
    };


    if (!isOpen) return null;

    return (
        <>
            <motion.div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                onClick={onClose}
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
            >
                <motion.div 
                    className="relative w-full max-w-4xl p-8 space-y-4 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                    onClick={(e) => e.stopPropagation()}
                    variants={modalVariants}
                >
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200">
                        <FiX size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Incoming JIT Access Requests</h2>
                    
                    <div className="max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <LoadingSpinner />
                            </div>
                        ) : requests.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-10">There are no incoming room access requests.</p>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User & Room</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Requested</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Approve For</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                    {requests.map(req => (
                                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white" title={req.requester_email}>{req.requester_email}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400" title={req.room_name}>{req.room_name} ({req.room_code})</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                                                    req.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                                    req.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : 
                                                    'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {formatDuration(req.requested_duration_seconds)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {req.status === 'pending' ? (
                                                    <DurationInput
                                                        duration={durations[req.id] || { hours: '', minutes: '', seconds: '' }}
                                                        onChange={(newDuration) => handleDurationChange(req.id, newDuration)}
                                                    />
                                                ) : (
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">{formatDuration(req.approved_duration_seconds)}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4">
                                                {req.status === 'pending' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleApprove(req)}
                                                            className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors duration-200"
                                                            title="Approve"
                                                        >
                                                            <FiCheck size={16} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(req)}
                                                            className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                                            title="Reject"
                                                        >
                                                            <FiAlertTriangle size={16} /> Reject
                                                        </button>
                                                    </>
                                                )}
                                                {req.status === 'approved' && (
                                                    <button
                                                        onClick={() => handleRevoke(req)}
                                                        className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                                        title="Revoke Access"
                                                    >
                                                        <FiTrash2 size={16} /> Revoke
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {/* --- [BLOCK 4] ADD CONFIRM MODAL RENDER --- */}
            <AnimatePresence>
                {isConfirmModalOpen && (
                    <ConfirmModal
                        isOpen={isConfirmModalOpen}
                        onClose={handleCloseConfirmModal}
                        onConfirm={onConfirmRevoke}
                        isConfirming={isConfirmingAction}
                        title="Revoke Access?"
                        message={`Are you sure you want to revoke access for ${confirmationState?.request.requester_email}? They will be immediately disconnected.`}
                        confirmText="Revoke"
                        confirmVariant="danger"
                    />
                )}
            </AnimatePresence>
            {/* --- [END BLOCK 4] --- */}
        </>
    );
};

export default IncomingJitModal;