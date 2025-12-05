// frontend/src/components/modals/RoomPasswordModal.js

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiLock, FiLogIn } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

// Animation variants
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

const RoomPasswordModal = ({ isOpen, onClose, onSubmit, roomName }) => {
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null); // In case we want to add auth-failed logic

    // Focus the input when the modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                document.getElementById('room-password-input')?.focus();
            }, 100);
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!password) {
            setError('Password is required.');
            return;
        }
        setIsSubmitting(true);
        // We don't need to show a spinner, as the page will navigate.
        // The onSubmit prop will trigger the navigation.
        console.log('[RoomPasswordModal] Submitting password...');
        onSubmit(password);
        // We don't call onClose() here, as the page navigation will unmount this component.
    };

    const handleClose = () => {
        if (isSubmitting) return;
        setPassword('');
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
                        className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-2xl dark:bg-gray-800"
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
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                                <FiLock className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white" id="modal-title">
                                Password Required
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    The room "<strong className="font-medium text-gray-900 dark:text-white">{roomName}</strong>" is password-protected.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                            <div>
                                <label 
                                    htmlFor="room-password-input" 
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Room Password
                                </label>
                                <input
                                    type="password"
                                    id="room-password-input"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError(null);
                                    }}
                                    className="mt-1 block w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="Enter password..."
                                />
                            </div>
                            
                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSubmitting ? <LoadingSpinner size="sm" /> : <FiLogIn />}
                                {isSubmitting ? 'Joining...' : 'Join Room'}
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default RoomPasswordModal;