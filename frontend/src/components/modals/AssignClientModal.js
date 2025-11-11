// frontend/src/components/modals/AssignClientModal.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheckCircle, FiSave, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';
// --- [FIX] Import getClients, not getAllClients ---
import { getClients } from '../../services/api'; 

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

const AssignClientModal = ({ isOpen, onClose, onUpdate, adminUser, api }) => {
    const { getAdminClientAssignments, updateAdminClientAssignments } = api;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    
    // State for the two lists
    const [availableClients, setAvailableClients] = useState([]);
    const [assignedClients, setAssignedClients] = useState([]);
    
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch data on modal open
    const fetchClients = useCallback(async () => {
        if (!adminUser) return;
        
        console.log(`[AssignClientModal] Fetching assignments for admin: ${adminUser.email}`);
        setIsLoading(true);
        setError(null);
        setSearchTerm('');
        try {
            // --- [FIX] Use getClients, which is filtered by the PO's product on the backend ---
            // This API must be called by a PO/CTO
            const allClientsResponse = await getClients(); 
            const allProductClients = allClientsResponse.data;
            console.log('[AssignClientModal] All product clients:', allProductClients);

            console.log(`[AssignClientModal] Fetching assignments for admin ID: ${adminUser.id}`);
            const assignmentsResponse = await getAdminClientAssignments(adminUser.id);
            
            // --- [FIX] Use the assignments from the specific API call ---
            const assignedClientMap = new Set(assignmentsResponse.data.assignedClients.map(client => client.id));
            
            const available = [];
            const assigned = [];

            allProductClients.forEach(client => {
                // Only show clients relevant to the Admin's product
                if (client.product_id === adminUser.product_id) {
                    if (assignedClientMap.has(client.id)) {
                        assigned.push(client);
                    } else {
                        available.push(client);
                    }
                }
            });

            // Sort lists alphabetically
            const sortedAvailable = available.sort((a, b) => a.name.localeCompare(b.name));
            const sortedAssigned = assigned.sort((a, b) => a.name.localeCompare(b.name));

            setAvailableClients(sortedAvailable);
            setAssignedClients(sortedAssigned);
            console.log(`[AssignClientModal] Found ${sortedAvailable.length} available, ${sortedAssigned.length} assigned.`);

        } catch (err) {
            console.error('[AssignClientModal] Error fetching data:', err);
            setError(err.response?.data?.message || "Failed to load clients.");
        } finally {
            setIsLoading(false);
        }
    }, [adminUser, getAdminClientAssignments]); // Removed isOpen

    useEffect(() => {
        if (isOpen) {
            fetchClients();
        }
    }, [isOpen, fetchClients]); // 'fetchClients' is now stable

    // Handlers to move clients between lists
    const handleAssign = (clientToAssign) => {
        setAvailableClients(prev => prev.filter(c => c.id !== clientToAssign.id));
        setAssignedClients(prev => [...prev, clientToAssign].sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handleUnassign = (clientToUnassign) => {
        setAssignedClients(prev => prev.filter(c => c.id !== clientToUnassign.id));
        setAvailableClients(prev => [...prev, clientToUnassign].sort((a, b) => a.name.localeCompare(b.name)));
    };

    // Filtered lists based on search term
    const filteredAvailable = useMemo(() => {
        // --- [FIX] Only filter by name, as email is not available ---
        return availableClients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [availableClients, searchTerm]);

    const filteredAssigned = useMemo(() => {
        // --- [FIX] Only filter by name, as email is not available ---
        return assignedClients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [assignedClients, searchTerm]);

    // Handle final save
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        const assignedIds = assignedClients.map(c => c.id);
        console.log(`[AssignClientModal] Saving ${assignedIds.length} assignments for admin ${adminUser.id}`);

        try {
            await updateAdminClientAssignments(adminUser.id, assignedIds);
            onUpdate({ message: `Client assignments for ${adminUser.email} updated.`, type: 'success' });
            onClose();
        } catch (err) {
            console.error('[AssignClientModal] Error saving assignments:', err);
            setError(err.response?.data?.message || "Failed to save assignments.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

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
                        className="relative w-full max-w-2xl p-6 bg-white rounded-lg shadow-2xl dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                        variants={modalVariants}
                    >
                        <button 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="absolute top-4 right-4 p-2 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
                            aria-label="Close modal"
                        >
                            <FiX size={24} />
                        </button>
                        
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Assign Clients</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Select clients for <span className="font-medium text-blue-600 dark:text-blue-400">{adminUser.email}</span>
                        </p>

                        <div className="relative my-4">
                            <input
                                type="text"
                                placeholder="Search clients..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {/* Available Clients */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Available Clients ({filteredAvailable.length})
                                    </h3>
                                    <div className="h-64 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-md p-2 space-y-1">
                                        {filteredAvailable.length > 0 ? filteredAvailable.map(client => (
                                            <button
                                                key={client.id}
                                                onClick={() => handleAssign(client)}
                                                className="w-full flex items-center justify-between text-left p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="truncate">{client.name}</span>
                                                <FiChevronRight className="flex-shrink-0" />
                                            </button>
                                        )) : (
                                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 p-4">No available clients found.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Assigned Clients */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Assigned Clients ({filteredAssigned.length})
                                    </h3>
                                    <div className="h-64 overflow-y-auto border border-blue-500 dark:border-blue-400 rounded-md p-2 space-y-1 bg-blue-50/30 dark:bg-gray-700/30">
                                        {filteredAssigned.length > 0 ? filteredAssigned.map(client => (
                                            <button
                                                key={client.id}
                                                onClick={() => handleUnassign(client)}
                                                className="w-full flex items-center justify-between text-left p-2 rounded-md text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <FiChevronLeft className="flex-shrink-0" />
                                                <span className="truncate text-right">{client.name}</span>
                                            </button>
                                        )) : (
                                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 p-4">No clients assigned.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {error && <p className="text-sm text-red-500 text-center mt-4">{error}</p>}

                        <div className="flex justify-end gap-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="relative flex justify-center px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md group hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                className="relative flex justify-center items-center gap-2 w-40 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                            >
                                {isSaving ? <LoadingSpinner size="sm" /> : <FiSave size={16} />}
                                {isSaving ? 'Saving...' : 'Save Assignments'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AssignClientModal;