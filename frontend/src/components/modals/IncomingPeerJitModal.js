// frontend/src/components/modals/IncomingPeerJitModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertTriangle, FiGift, FiPackage } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

// Animation variants for the modal (no longer unused)
const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
};

const modalVariants = {
    hidden: { y: "-30px", opacity: 0 },
    visible: { y: "0", opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
    exit: { y: "30px", opacity: 0, transition: { duration: 0.2 } },
};

// Helper component for duration inputs
const DurationInput = ({ duration, onChange }) => {
    const handleChange = (e) => {
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
                onChange={handleChange}
                className="block w-14 px-2 py-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                placeholder="h"
            />
            <input
                type="text"
                name="minutes"
                value={duration.minutes}
                onChange={handleChange}
                className="block w-14 px-2 py-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                placeholder="m"
            />
            <input
                type="text"
                name="seconds"
                value={duration.seconds}
                onChange={handleChange}
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

const IncomingPeerJitModal = ({ isOpen, onClose, onUpdate, api }) => {
    const { getIncomingPeerRequests, respondToPeerRequest } = api;

    const [isLoading, setIsLoading] = useState(true);
    const [productRequests, setProductRequests] = useState([]);
    const [clientRequests, setClientRequests] = useState([]);
    const [durations, setDurations] = useState({});
    const [error, setError] = useState(null);

    const fetchRequests = useCallback(async () => {
        if (!isOpen) return;
        console.log('[IncomingPeerJitModal] Fetching incoming peer requests...');
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await getIncomingPeerRequests();
            setProductRequests(data.productRequests || []);
            setClientRequests(data.clientRequests || []);
            
            // Set default durations
            const initialDurations = {};
            [...(data.productRequests || []), ...(data.clientRequests || [])].forEach(req => {
                initialDurations[`${req.type}-${req.id}`] = { hours: '4', minutes: '0', seconds: '0' };
            });
            setDurations(initialDurations);

        } catch (err) {
            console.error('[IncomingPeerJitModal] Error fetching requests:', err);
            setError(err.response?.data?.message || "Failed to load requests.");
        } finally {
            setIsLoading(false);
        }
    }, [isOpen, getIncomingPeerRequests]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleDurationChange = (key, newDuration) => {
        setDurations(prev => ({ ...prev, [key]: newDuration }));
    };

    const handleRespond = async (request, type, action) => {
        const key = `${type}-${request.id}`;
        const duration = durations[key] || { hours: '4', minutes: '0', seconds: '0' };
        console.log(`[IncomingPeerJitModal] Responding to ${type} request ${request.id} with action: ${action}`);
        
        setIsLoading(true); // Use main loader for simplicity
        try {
            await respondToPeerRequest(request.id, type, action, duration);
            onUpdate({ message: `Request for ${request.resource_name} has been ${action}.`, type: 'success' });
            fetchRequests(); // Refresh the list
        } catch (err) {
            console.error(`[IncomingPeerJitModal] Error responding to request:`, err);
            setError(err.response?.data?.message || `Failed to ${action} request.`);
            onUpdate({ message: err.response?.data?.message || `Failed to ${action} request.`, type: 'error' });
            setIsLoading(false);
        }
        // setIsLoading(false) is in the finally block of fetchRequests
    };

    const renderRequestList = (requests, type) => {
        if (requests.length === 0) {
            return <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No pending {type} requests.</p>;
        }

        return (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User & Resource</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Requested</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Approve For</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {requests.map(req => {
                        const key = `${type}-${req.id}`;
                        return (
                            <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white" title={req.requester_email}>{req.requester_email}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400" title={req.resource_name}>{req.resource_name}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {formatDuration(req.requested_duration_seconds)}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <DurationInput
                                        duration={durations[key] || { hours: '', minutes: '', seconds: '' }}
                                        onChange={(newDuration) => handleDurationChange(key, newDuration)}
                                    />
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4">
                                    <button 
                                        onClick={() => handleRespond(req, type, 'approved')}
                                        className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors duration-200"
                                        title="Approve"
                                    >
                                        <FiCheck size={16} /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleRespond(req, type, 'rejected')}
                                        className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                        title="Reject"
                                    >
                                        <FiAlertTriangle size={16} /> Reject
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                // --- [FIX] Pass animation variants ---
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                    onClick={onClose}
                    variants={backdropVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <motion.div
                        className="relative w-full max-w-4xl p-8 space-y-4 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                        onClick={(e) => e.stopPropagation()}
                        variants={modalVariants}
                    >
                    {/* --- [END FIX] --- */}
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200">
                            <FiX size={24} />
                        </button>
                        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Incoming Peer Access Requests</h2>
                        
                        {error && <p className="text-center text-red-500 py-2">{error}</p>}
                        
                        <div className="max-h-[70vh] overflow-y-auto space-y-6">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-48">
                                    <LoadingSpinner />
                                </div>
                            ) : (
                                <>
                                    {/* Product Requests */}
                                    {productRequests.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                                <FiPackage /> Product Requests
                                            </h3>
                                            <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
                                                {renderRequestList(productRequests, 'product')}
                                            </div>
                                        </div>
                                    )}

                                    {/* Client Requests */}
                                    {clientRequests.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                                <FiGift /> Client Requests
                                            </h3>
                                            <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
                                                {renderRequestList(clientRequests, 'client')}
                                            </div>
                                        </div>
                                    )}

                                    {productRequests.length === 0 && clientRequests.length === 0 && (
                                        <p className="text-center text-gray-500 dark:text-gray-400 py-10">
                                            There are no incoming peer access requests.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default IncomingPeerJitModal;