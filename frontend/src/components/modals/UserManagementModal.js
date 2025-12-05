// frontend/src/components/modals/UserManagementModal.js

// --- [BUG_FIX] Import useMemo and useCallback ---
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    getPendingUsers,
    approveUser,
    rejectUser,
    getAllTeamMembers,
    deactivateUser,
    reactivateUser,
    getAllUsersForCto,
    // --- [BLOCK 5] 1. Import new API functions ---
    getAdminClientAssignments,
    updateAdminClientAssignments
} from '../../services/api';
// --- [BLOCK 5] 2. Import FiBriefcase and FiSearch ---
import { FiX, FiUserCheck, FiTrash2, FiSearch, FiBriefcase } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmModal from './ConfirmModal';
// --- [BLOCK 5] 3. Import new modal ---
import AssignClientModal from './AssignClientModal';

const UserManagementModal = ({ isOpen, onClose, userRole, onUpdate }) => {
    // --- [BUG_FIX] 3. Set initial view based on role ---
    const [view, setView] = useState(userRole === 'CTO' ? 'team' : 'pending'); // 'pending' or 'team'
    const [pendingUsers, setPendingUsers] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- [BUG_FIX] 4. Add state for search ---
    const [searchTerm, setSearchTerm] = useState('');

    // --- [BLOCK 4] New state for confirmation modal ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [confirmationState, setConfirmationState] = useState(null); // { action: 'reject' | 'deactivate', user: { id, email } }

    // --- [BLOCK 5] 4. Add state for new assignment modal ---
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState(null);

    // --- [BUG_FIX] Wrap fetchPending in useCallback ---
    const fetchPending = useCallback(async () => {
        // --- [BUG_FIX] 5. CTO should never fetch pending users ---
        if (userRole === 'CTO') {
            setPendingUsers([]);
            return;
        }
        console.log('[USER_MGMT_MODAL] Fetching pending users...');
        setIsLoading(true);
        setError(null);
        try {
            const response = await getPendingUsers();
            console.log('[USER_MGMT_MODAL] Fetched pending users:', response.data);
            setPendingUsers(response.data);
        } catch (err) {
            console.error('[USER_MGMT_MODAL] Error fetching pending users:', err);
            setError(err.response?.data?.message || 'Failed to load pending users.');
        } finally {
            setIsLoading(false);
        }
    }, [userRole]); // Dependency array for useCallback

    // --- [BUG_FIX] Wrap fetchTeam in useCallback ---
    const fetchTeam = useCallback(async () => {
        console.log(`[USER_MGMT_MODAL] [BUG_FIX] Fetching team members for role: ${userRole}`);
        setIsLoading(true);
        setError(null);
        setSearchTerm(''); // Reset search on fetch
        try {
            let response;
            // --- [BUG_FIX] 6. Use correct API based on role ---
            if (userRole === 'CTO') {
                console.log('[USER_MGMT_MODAL_API] Calling getAllUsersForCto()...');
                response = await getAllUsersForCto();
            } else {
                console.log('[USER_MGMT_MODAL_API] Calling getAllTeamMembers()...');
                response = await getAllTeamMembers();
            }
            console.log('[USER_MGMT_MODAL] Fetched all team members:', response.data);
            setTeamMembers(response.data);
        } catch (err) {
            console.error('[USER_MGMT_MODAL] Error fetching team:', err);
            setError(err.response?.data?.message || 'Failed to load team members.');
        } finally {
            setIsLoading(false);
        }
    }, [userRole]); // Dependency array for useCallback

    useEffect(() => {
        if (isOpen) {
            // --- [BUG_FIX] 7. Force view to 'team' if CTO ---
            const currentView = userRole === 'CTO' ? 'team' : view;
            if (currentView === 'pending') {
                fetchPending();
            } else {
                fetchTeam();
            }
        }
    // --- [BUG_FIX] Add fetchPending and fetchTeam to the dependency array ---
    }, [isOpen, view, userRole, fetchPending, fetchTeam]);

    const handleApprove = async (userId, email) => {
        console.log(`[USER_MGMT_MODAL] Attempting to approve user ${userId}`);
        try {
            await approveUser(userId);
            console.log(`[USER_MGMT_MODAL] Successfully approved user ${userId}`);
            onUpdate({ message: `User ${email} approved successfully!`, type: 'success' });
            fetchPending(); // Refresh pending list
        } catch (err) {
            console.error(`[USER_MGMT_MODAL] Error approving user ${userId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to approve user.', type: 'error' });
        }
    };

    const handleReject = (userId, email) => {
        console.log(`[USER_MGMT_MODAL] [BLOCK_4] Staging REJECT action for user ${userId}`);
        setConfirmationState({
            action: 'reject',
            user: { id: userId, email: email },
            title: `Reject User?`,
            message: `Are you sure you want to reject and delete ${email}? This action cannot be undone.`,
            confirmText: 'Reject & Delete',
            confirmVariant: 'danger'
        });
        setIsConfirmModalOpen(true);
    };

    const handleDeactivate = (userId, email) => {
        console.log(`[USER_MGMT_MODAL] [BLOCK_4] Staging DEACTIVATE action for user ${userId}`);
        setConfirmationState({
            action: 'deactivate',
            user: { id: userId, email: email },
            title: 'Deactivate User?',
            message: `Are you sure you want to deactivate ${email}? Their access will be revoked immediately.`,
            confirmText: 'Deactivate',
            confirmVariant: 'danger'
        });
        setIsConfirmModalOpen(true);
    };

    const onConfirmAction = async () => {
        if (!confirmationState) return;

        const { action, user } = confirmationState;
        const { id, email } = user;

        setIsConfirmingAction(true);
        console.log(`[USER_MGMT_MODAL] [BLOCK_4] Executing confirmed action '${action}' for user ${id}`);

        try {
            if (action === 'reject') {
                await rejectUser(id);
                console.log(`[USER_MGMT_MODAL] Successfully rejected user ${id}`);
                onUpdate({ message: `User ${email} rejected and deleted.`, type: 'success' });
                fetchPending(); // Refresh pending list
            } else if (action === 'deactivate') {
                await deactivateUser(id);
                console.log(`[USER_MGMT_MODAL] Successfully deactivated user ${id}`);
                onUpdate({ message: `User ${email} has been deactivated.`, type: 'success' });
                fetchTeam(); // Refresh team list
            }
            handleCloseConfirmModal(); // Close modal on success
        } catch (err) {
            console.error(`[USER_MGMT_MODAL] Error during confirmed action '${action}' for user ${id}:`, err);
            onUpdate({ message: err.response?.data?.message || `Failed to ${action} user.`, type: 'error' });
        } finally {
            setIsConfirmingAction(false); // Stop loading regardless
        }
    };

    const handleCloseConfirmModal = () => {
        console.log('[USER_MGMT_MODAL] [BLOCK_4] Closing confirmation modal.');
        setIsConfirmModalOpen(false);
        setTimeout(() => {
            setConfirmationState(null);
        }, 300);
    };

    const handleReactivate = async (userId, email) => {
        try {
            await reactivateUser(userId);
            onUpdate({ message: `User ${email} has been reactivated.`, type: 'success' });
            fetchTeam(); // Refresh team list
        } catch (err) {
            console.error(`[USER_MGMT_MODAL] Error reactivating user ${userId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to reactivate user.', type: 'error' });
        }
    };

    // --- [BLOCK 5] 5. New Handlers for AssignClientModal ---
    const handleOpenAssignModal = (adminUser) => {
        console.log(`[USER_MGMT_MODAL] [BLOCK_5] Opening assign client modal for admin:`, adminUser.email);
        setSelectedAdmin(adminUser);
        setIsAssignModalOpen(true);
    };

    const handleCloseAssignModal = () => {
        console.log('[USER_MGMT_MODAL] [BLOCK_5] Closing assign client modal.');
        setIsAssignModalOpen(false);
        setSelectedAdmin(null);
    };

    const onAssignmentUpdate = (toastMessage) => {
        console.log('[USER_MGMT_MODAL] [BLOCK_5] Client assignment updated.');
        onUpdate(toastMessage); // Pass toast up to Dashboard
        // No need to fetchTeam(), socket event 'CLIENT_LIST_UPDATED' will trigger refresh.
    };
    // --- [END BLOCK 5] ---

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'deactivated':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'suspended_user':
            case 'suspended_admin':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    };

    // --- [BUG_FIX] 8. Memoize filtered results ---
    const filteredTeamMembers = useMemo(() => {
        if (!searchTerm) return teamMembers;
        return teamMembers.filter(user => 
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [teamMembers, searchTerm]);


    if (!isOpen) return null;

    return (
        <>
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                onClick={onClose}
            >
                <div 
                    className="relative w-full max-w-4xl p-8 space-y-4 bg-white rounded-lg shadow-2xl dark:bg-gray-900" // --- [BLOCK 5] Widened modal to max-w-4xl ---
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                        <FiX size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">User Management</h2>
                    
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        {/* --- [BUG_FIX] 9. Hide Pending tab for CTO --- */}
                        {userRole !== 'CTO' && (
                            <button 
                                onClick={() => setView('pending')} 
                                className={`px-4 py-2 font-medium ${view === 'pending' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                Pending Approval
                            </button>
                        )}
                        <button 
                            onClick={() => setView('team')} 
                            className={`px-4 py-2 font-medium ${view === 'team' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {/* --- [BUG_FIX] 10. Change tab name for CTO --- */}
                            {userRole === 'CTO' ? 'Company View' : 'Manage Team'}
                        </button>
                    </div>

                    {error && <p className="text-center text-red-500">{error}</p>}
                    
                    <div className="max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <>
                                {view === 'pending' && userRole !== 'CTO' && (
                                    <>
                                        {pendingUsers.length === 0 ? (
                                            <p className="text-center text-gray-500 dark:text-gray-400 py-10">There are no users pending approval.</p>
                                        ) : (
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role Requested</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {pendingUsers.map(user => (
                                                        <tr key={user.id}>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.email}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.role}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(user.status)}`}>
                                                                    {user.status.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4">
                                                                <button 
                                                                    onClick={() => handleApprove(user.id, user.email)}
                                                                    className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                                >
                                                                    <FiUserCheck size={16} /> Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReject(user.id, user.email)}
                                                                    className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                >
                                                                    <FiTrash2 size={16} /> Reject
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </>
                                )}
                                
                                {view === 'team' && (
                                    <>
                                        <div className="relative my-4">
                                            <input
                                                type="text"
                                                placeholder="Search by email..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        </div>

                                        {filteredTeamMembers.length === 0 ? (
                                            <p className="text-center text-gray-500 dark:text-gray-400 py-10">
                                                {searchTerm ? 'No users match your search.' : (userRole === 'CTO' ? 'No users found in the company.' : 'You do not have any team members yet.')}
                                            </p>
                                        ) : (
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                        {/* --- [BLOCK 5] 6. Add new column header (PO/CTO) --- */}
                                                        {(userRole === 'ProductOwner' || userRole === 'CTO') && (
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assign Clients</th>
                                                        )}
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {filteredTeamMembers.map(user => (
                                                        <tr key={user.id}>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.email}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.role}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(user.status)}`}>
                                                                    {user.status.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            {/* --- [BLOCK 5] 7. Add new cell with button --- */}
                                                            {(userRole === 'ProductOwner' || userRole === 'CTO') && (
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    {user.role === 'Administrator' ? (
                                                                        <button 
                                                                            onClick={() => handleOpenAssignModal(user)}
                                                                            className="flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                                        >
                                                                            <FiBriefcase size={16} /> Assign
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-500">N/A</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                {user.status === 'active' && userRole !== 'CTO' && (
                                                                    <button 
                                                                        onClick={() => handleDeactivate(user.id, user.email)}
                                                                        className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                    >
                                                                        <FiX size={16} /> Deactivate
                                                                    </button>
                                                                )}
                                                                {user.status === 'deactivated' && userRole !== 'CTO' && (
                                                                    <button 
                                                                        onClick={() => handleReactivate(user.id, user.email)}
                                                                        className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                                    >
                                                                        <FiUserCheck size={16} /> Reactivate
                                                                    </button>
                                                                )}
                                                                {userRole === 'CTO' && (
                                                                    <span className="text-xs text-gray-500">N/A</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={onConfirmAction}
                isConfirming={isConfirmingAction}
                title={confirmationState?.title || "Are you sure?"}
                message={confirmationState?.message || ""}
                confirmText={confirmationState?.confirmText || "Confirm"}
                confirmVariant={confirmationState?.confirmVariant || "danger"}
            />

            {/* --- [BLOCK 5] 8. Render the new modal --- */}
            {selectedAdmin && (
                <AssignClientModal
                    isOpen={isAssignModalOpen}
                    onClose={handleCloseAssignModal}
                    onUpdate={onAssignmentUpdate}
                    adminUser={selectedAdmin}
                    api={{ getAdminClientAssignments, updateAdminClientAssignments }}
                />
            )}
        </>
    );
};

export default UserManagementModal;