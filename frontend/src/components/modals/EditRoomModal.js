// frontend/src/components/modals/EditRoomModal.js

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiLock } from 'react-icons/fi';
import Toast from '../../Toast';

// Animation variants for the modal
const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const modalVariants = {
    hidden: { y: "-50vh", opacity: 0 },
    visible: { y: "0", opacity: 1, transition: { type: "spring", stiffness: 120 } },
    exit: { y: "50vh", opacity: 0, transition: { duration: 0.3 } },
};

const EditRoomModal = ({ isOpen, onClose, room, setToast, refreshData, api }) => {
    console.log(`[EditRoomModal] Render. isOpen: ${isOpen}. Room: ${room?.name}`);
    
    const [newPassword, setNewPassword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [modalToast, setModalToast] = useState(null);

    // When the modal opens, pre-fill the password state.
    // We pre-fill with an empty string regardless, as we don't know the password.
    // The user just types a new one or leaves it blank to remove.
    useEffect(() => {
        if (isOpen) {
            console.log(`[EditRoomModal] Modal opened for room: ${room.name}`);
            setNewPassword(''); // Always start blank for security
            setIsUpdating(false);
            setModalToast(null);
        }
    }, [isOpen, room]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(`[EditRoomModal] Form submitted for room: ${room.id}.`);
        setIsUpdating(true);
        setModalToast(null);

        // The API understands an empty string as "remove password"
        const passwordToSet = newPassword.trim() === '' ? '' : newPassword;

        try {
            console.log(`[EditRoomModal] Calling api.editRoomPassword for room ${room.id}.`);
            await api.editRoomPassword(room.id, passwordToSet);
            
            console.log(`[EditRoomModal] Password updated successfully.`);
            setToast({ 
                message: `Password for "${room.name}" updated successfully.`, 
                type: 'success' 
            });
            
            refreshData(); // Refresh dashboard to show new lock icon status
            onClose(); // Close the modal

        } catch (error) {
            console.error('[EditRoomModal] Failed to update password:', error);
            const errMsg = error.response?.data?.message || 'Failed to update password.';
            setModalToast({ message: errMsg, type: 'error' });
        } finally {
            setIsUpdating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
        >
            {/* Modal-specific toast container */}
            <div className="absolute top-0 right-0 p-4">
                {modalToast && <Toast message={modalToast.message} type={modalToast.type} onClose={() => setModalToast(null)} />}
            </div>

            <motion.div
                className="relative w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
                    aria-label="Close modal"
                >
                    <FiX size={24} />
                </button>
                
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Edit Room Password</h2>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    You are editing <span className="font-medium text-blue-600 dark:text-blue-400">{room.name}</span>
                </p>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label 
                            htmlFor="room-password" 
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            New Room Password
                        </label>
                        <div className="relative mt-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <FiLock className="h-5 w-5 text-gray-400" />
                            </span>
                            <input
                                id="room-password"
                                name="password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                className="pl-10 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors duration-200"
                                placeholder="Leave blank to make room public"
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Enter a new password. To remove the password and make this room public, leave this field blank and click "Update".
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUpdating}
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md group hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isUpdating}
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                        >
                            {isUpdating ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default EditRoomModal;