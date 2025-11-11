// frontend/src/components/modals/PeerRequestModal.js

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSend, FiLock } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';
import { requestPeerAccess } from '../../services/api';

// Animation variants for the modal
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
        <div className="flex space-x-2">
            <input
                type="text" name="hours" value={duration.hours} onChange={handleChange}
                className="block w-20 px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Hours"
            />
            <input
                type="text" name="minutes" value={duration.minutes} onChange={handleChange}
                className="block w-20 px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Minutes"
            />
            <input
                type="text" name="seconds" value={duration.seconds} onChange={handleChange}
                className="block w-20 px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Seconds"
            />
        </div>
    );
};


const PeerRequestModal = ({ isOpen, onClose, resourceType, resource, setToast }) => {
    const [duration, setDuration] = useState({ hours: '4', minutes: '0', seconds: '0' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const resourceName = resource?.product_name || resource?.name;
    const resourceId = resource?.id;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!resourceId || !resourceType) {
            setError("Resource information is missing.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        
        try {
            await requestPeerAccess(resourceType, resourceId, duration);
            setToast({ message: `Access request for ${resourceName} submitted!`, type: 'success' });
            onClose();
        } catch (err) {
            console.error('[PeerRequestModal] Error submitting request:', err);
            setError(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset state on close
    const handleClose = () => {
        if (isSubmitting) return;
        setDuration({ hours: '4', minutes: '0', seconds: '0' });
        setError(null);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                    onClick={handleClose}
                    variants={backdropVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <motion.div
                        className="relative w-full max-w-lg p-6 bg-white rounded-lg shadow-2xl dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                        variants={modalVariants}
                    >
                        <button 
                            onClick={handleClose} 
                            disabled={isSubmitting}
                            className="absolute top-4 right-4 p-2 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
                            aria-label="Close modal"
                        >
                            <FiX size={24} />
                        </button>
                        
                        <div className="flex flex-col items-center text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300">
                                <FiLock className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white" id="modal-title">
                                Request Access
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    You are requesting temporary access to the {resourceType}:<br />
                                    <strong className="font-medium text-gray-900 dark:text-white">{resourceName}</strong>
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                    Request access for:
                                </label>
                                <div className="flex justify-center">
                                    <DurationInput duration={duration} onChange={setDuration} />
                                </div>
                            </div>
                            
                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSubmitting ? <LoadingSpinner size="sm" /> : <FiSend />}
                                {isSubmitting ? 'Sending Request...' : 'Send Request'}
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PeerRequestModal;