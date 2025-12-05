import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // <-- 1. Import motion
import { FiX, FiSend } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

// --- 2. Accept animation variants as props ---
const RequestAccessModal = ({ isOpen, onClose, onSuccess, api, backdropVariants, modalVariants }) => {
    const [roomCode, setRoomCode] = useState('');
    const [password, setPassword] = useState('');
    const [duration, setDuration] = useState({ hours: '', minutes: '', seconds: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setRoomCode('');
            setPassword('');
            setDuration({ hours: '1', minutes: '0', seconds: '0' }); // Default to 1 hour
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleDurationChange = (e) => {
        const { name, value } = e.target;
        // Only allow numbers
        if (/^[0-9]*$/.test(value)) {
            setDuration(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        // ... (function logic unchanged)
        e.preventDefault();
        console.log('[JIT_REQUEST_MODAL] Submitting access request...');
        setError(null);
        
        const durHours = parseInt(duration.hours || 0);
        const durMinutes = parseInt(duration.minutes || 0);
        const durSeconds = parseInt(duration.seconds || 0);
        
        if (durHours + durMinutes + durSeconds <= 0) {
            setError('Please request a duration greater than 0 seconds.');
            return;
        }

        if (!roomCode) {
            setError('Room Code is required.');
            return;
        }

        setIsLoading(true);
        try {
            const requestData = {
                roomCode,
                password: password || null,
                duration: {
                    hours: durHours,
                    minutes: durMinutes,
                    seconds: durSeconds,
                }
            };
            console.log('[JIT_REQUEST_MODAL] Sending API request:', requestData);
            await api.requestAccess(requestData);
            
            console.log('[JIT_REQUEST_MODAL] Request submitted successfully.');
            onSuccess({ message: 'Access request submitted!', type: 'success' });
            onClose();

        } catch (err) {
            console.error('[JIT_REQUEST_MODAL] Error submitting request:', err);
            setError(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        // --- 3. Wrap entire modal in motion.div ---
        <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
        >
            {/* --- 4. Wrap modal content in motion.div --- */}
            <motion.div 
                className="relative w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
                variants={modalVariants}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200">
                    <FiX size={24} />
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Request Room Access</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Room Code
                        </label>
                        <input
                            id="roomCode"
                            type="text"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Room Password <span className="text-xs text-gray-400">(if required)</span>
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                            placeholder="Enter room password"
                        />
                    </div>
                    
                    <fieldset>
                        <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Requested Duration
                        </legend>
                        <div className="mt-1 flex space-x-2">
                            <input
                                type="text"
                                name="hours"
                                value={duration.hours}
                                onChange={handleDurationChange}
                                className="block w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                                placeholder="Hours"
                            />
                            <input
                                type="text"
                                name="minutes"
                                value={duration.minutes}
                                onChange={handleDurationChange}
                                className="block w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                                placeholder="Minutes"
                            />
                            <input
                                type="text"
                                name="seconds"
                                value={duration.seconds}
                                onChange={handleDurationChange}
                                className="block w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-200"
                                placeholder="Seconds"
                            />
                        </div>
                    </fieldset>

                    {error && (
                        <p className="text-sm text-red-500 text-center">{error}</p>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                    >
                        {isLoading ? <LoadingSpinner /> : <FiSend />}
                        Submit Request
                    </button>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default RequestAccessModal;