import React, { useState, useEffect } from 'react';
import {
    getPendingUsers,
    approveUser,
    rejectUser,
    getAllTeamMembers,
    deactivateUser,
    reactivateUser
} from '../../services/api';
import { FiX, FiUserCheck, FiTrash2 } from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

const UserManagementModal = ({ isOpen, onClose, userRole, onUpdate }) => {
    const [view, setView] = useState('pending'); // 'pending' or 'team'
    const [pendingUsers, setPendingUsers] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPending = async () => {
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
    };

    const fetchTeam = async () => {
        console.log('[USER_MGMT_MODAL] Fetching all team members...');
        setIsLoading(true);
        setError(null);
        try {
            const response = await getAllTeamMembers();
            console.log('[USER_MGMT_MODAL] Fetched all team members:', response.data);
            setTeamMembers(response.data);
        } catch (err) {
            console.error('[USER_MGMT_MODAL] Error fetching team:', err);
            setError(err.response?.data?.message || 'Failed to load team members.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (view === 'pending') {
                fetchPending();
            } else {
                fetchTeam();
            }
        }
    }, [isOpen, view]);

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

    const handleReject = async (userId, email) => {
        console.log(`[USER_MGMT_MODAL] Attempting to REJECT user ${userId}`);
        if (!window.confirm(`Are you sure you want to reject and delete the user ${email}? This action cannot be undone.`)) {
            return;
        }
        try {
            await rejectUser(userId);
            console.log(`[USER_MGMT_MODAL] Successfully rejected user ${userId}`);
            onUpdate({ message: `User ${email} rejected and deleted.`, type: 'success' });
            fetchPending(); // Refresh pending list
        } catch (err) {
            console.error(`[USER_MGMT_MODAL] Error rejecting user ${userId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to reject user.', type: 'error' });
        }
    };

    const handleDeactivate = async (userId, email) => {
        if (!window.confirm(`Are you sure you want to deactivate ${email}? Their access will be revoked immediately.`)) return;
        try {
            await deactivateUser(userId);
            onUpdate({ message: `User ${email} has been deactivated.`, type: 'success' });
            fetchTeam(); // Refresh team list
        } catch (err) {
            console.error(`[USER_MGMT_MODAL] Error deactivating user ${userId}:`, err);
            onUpdate({ message: err.response?.data?.message || 'Failed to deactivate user.', type: 'error' });
        }
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

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-3xl p-8 space-y-4 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                    <FiX size={24} />
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">User Management</h2>
                
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={() => setView('pending')} 
                        className={`px-4 py-2 font-medium ${view === 'pending' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Pending Approval
                    </button>
                    <button 
                        onClick={() => setView('team')} 
                        className={`px-4 py-2 font-medium ${view === 'team' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Manage Team
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
                            {view === 'pending' && (
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
                                    {teamMembers.length === 0 ? (
                                        <p className="text-center text-gray-500 dark:text-gray-400 py-10">You do not have any team members yet.</p>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                            <thead className="bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                                {teamMembers.map(user => (
                                                    <tr key={user.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.email}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.role}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(user.status)}`}>
                                                                {user.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            {user.status === 'active' && (
                                                                <button 
                                                                    onClick={() => handleDeactivate(user.id, user.email)}
                                                                    className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                >
                                                                    <FiX size={16} /> Deactivate
                                                                </button>
                                                            )}
                                                            {user.status === 'deactivated' && (
                                                                <button 
                                                                    onClick={() => handleReactivate(user.id, user.email)}
                                                                    className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                                >
                                                                    <FiUserCheck size={16} /> Reactivate
                                                                </button>
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
    );
};

export default UserManagementModal;