// frontend/src/components/modals/SendDownstreamModal.js

import React, { useState, useEffect, useCallback } from 'react'; // --- [LINT_FIX] Import useCallback ---
import { FiX, FiSend, FiUsers } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

const SendDownstreamModal = ({ isOpen, onClose, room, setToast, refreshData, userRole, api }) => {
    
    const [assignees, setAssignees] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedIds, setSelectedIds] = useState({}); 
    const [error, setError] = useState(null);

    const isPO = userRole === 'ProductOwner';
    const targetRole = isPO ? 'Admin' : 'User';
    const targetRolePlural = isPO ? 'Admins' : 'Users';

    // --- [LINT_FIX] Wrap fetchAssignees in useCallback ---
    const fetchAssignees = useCallback(async () => {
        if (room && userRole && api) {
            console.log(`[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Modal opened for room ${room.id}. Role ${userRole} fetching ${targetRolePlural}...`);
            setIsLoading(true);
            setError(null);
            setSelectedIds({});
            try {
                let list = [];
                if (isPO) {
                    console.log(`[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Calling api.getTeam() for PO.`);
                    const response = await api.getTeam();
                    list = response.data.filter(member => member.role === 'Administrator' || member.role === 'Admin');
                } else {
                    console.log(`[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Calling api.getUsersForAdmin() for Admin.`);
                    const response = await api.getUsersForAdmin();
                    list = response.data;
                }
                setAssignees(list);
                console.log(`[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Found ${list.length} ${targetRolePlural}.`);

            } catch (err) {
                console.error(`[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Error fetching ${targetRolePlural}:`, err);
                setError(err.response?.data?.message || 'Failed to load your team.');
            } finally {
                setIsLoading(false);
            }
        }
    // --- [LINT_FIX] Add all stable dependencies to useCallback ---
    }, [room, userRole, api, isPO, targetRolePlural]); 

    useEffect(() => {
        if (isOpen) {
            fetchAssignees();
        }
    // --- [LINT_FIX] Add the stable fetchAssignees function to useEffect's dependencies ---
    }, [isOpen, fetchAssignees]); 

    const handleToggleAssignee = (assigneeId) => {
        setSelectedIds(prev => ({
            ...prev,
            [assigneeId]: !prev[assigneeId] // Toggle boolean value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        const idArray = Object.keys(selectedIds).filter(id => selectedIds[id]);
        console.log(`[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Submitting... Room: ${room.id}, ${targetRolePlural} IDs:`, idArray);

        if (idArray.length === 0) {
            setError(`Please select at least one ${targetRole} to send this room to.`);
            return;
        }

        setIsSubmitting(true);
        try {
            await api.sendDownstream(room.id, idArray); 
            setToast({ message: `Room successfully sent downstream to ${targetRolePlural}!`, type: 'success' });
            refreshData(); // Refresh dashboard to update room state
            onClose();
        } catch (err) {
            console.error('[SEND_DOWNSTREAM_MODAL] [BLOCK_2] Error submitting:', err);
            setError(err.response?.data?.message || 'Failed to send room downstream.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !room) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                    <FiX size={24} />
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Send Room Downstream</h2>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    You are assigning "<strong>{room.name}</strong>" to specific {targetRolePlural}. They will be able to see and join this room.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select {targetRolePlural}
                        </label>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <LoadingSpinner />
                            </div>
                        ) : error ? (
                            <p className="text-center text-red-500">{error}</p>
                        ) : assignees.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-6">You have no {targetRolePlural} on your team to assign this to.</p>
                        ) : (
                            <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-300 dark:border-gray-700 p-4 space-y-2">
                                {assignees.map(assignee => (
                                    <label key={assignee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <input
                                            type="checkbox"
                                            checked={!!selectedIds[assignee.id]}
                                            onChange={() => handleToggleAssignee(assignee.id)}
                                            className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                                        />
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{assignee.email}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && !isLoading && (
                        <p className="text-sm text-red-500 text-center">{error}</p>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading || isSubmitting || assignees.length === 0}
                        className="w-full flex justify-center items-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSubmitting ? <LoadingSpinner /> : <FiSend />}
                        Send Downstream
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SendDownstreamModal;