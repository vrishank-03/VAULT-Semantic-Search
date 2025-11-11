// frontend/src/components/modals/ConfirmModal.js

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

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

/**
 * A reusable modal for confirming dangerous actions.
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is open.
 * @param {function} props.onClose - Function to call when "Cancel" or "X" is clicked.
 * @param {function} props.onConfirm - Function to call when "Confirm" is clicked.
 * @param {boolean} props.isConfirming - Pass in the parent's loading state.
 * @param {string} props.title - The title of the modal (e.g., "Deactivate User?").
 * @param {string} props.message - The descriptive message.
 * @param {string} props.confirmText - The text for the confirm button (e.g., "Deactivate").
 * @param {'danger' | 'primary'} [props.confirmVariant='danger'] - The color theme for the button.
 */
const ConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    isConfirming,
    title, 
    message, 
    confirmText,
    confirmVariant = 'danger' 
}) => {
    console.log(`[ConfirmModal] Render. isOpen: ${isOpen}, isConfirming: ${isConfirming}`);

    const confirmColorClasses = confirmVariant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
        : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600';

    const iconColorClasses = confirmVariant === 'danger'
        ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
        : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300';
    
    // We use AnimatePresence to allow the exit animation
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                    onClick={onClose}
                    variants={backdropVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <motion.div
                        className="relative w-full max-w-md p-6 space-y-4 bg-white rounded-lg shadow-2xl dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                        variants={modalVariants}
                    >
                        <button 
                            onClick={onClose} 
                            disabled={isConfirming}
                            className="absolute top-4 right-4 p-2 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
                            aria-label="Close modal"
                        >
                            <FiX size={24} />
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconColorClasses}`}>
                                <FiAlertTriangle className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {message}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:gap-4 gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isConfirming}
                                className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md group hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isConfirming}
                                className={`relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white border border-transparent rounded-md group disabled:opacity-50 transition-colors duration-200 ${confirmColorClasses}`}
                            >
                                {isConfirming ? (
                                    <LoadingSpinner size="sm" />
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;