import React from 'react';
import { FiClock } from 'react-icons/fi';

const OutgoingRequestsSection = ({ outgoingRequests, setToast }) => {
    if (outgoingRequests.length === 0) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                <p>You have not sent any JIT access requests.</p>
                <p className="mt-2">Click the "Request Access" button to request access to a room by its code.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {outgoingRequests.map((req) => (
                    <li key={req.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {req.room_name} <span className="text-sm font-mono text-blue-500">({req.room_code})</span>
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Owner: {req.owner_email}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Last Updated: {new Date(req.updated_at).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-4">
                            <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                                req.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                req.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : 
                                'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                            }`}>
                                {req.status}
                            </span>
                            {req.status === 'pending' && (
                                <button
                                    onClick={() => setToast({ message: 'Editing request time is not yet implemented.', type: 'info' })}
                                    className="flex items-center justify-center gap-2 p-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                                    title="Edit Request Time"
                                >
                                    <FiClock size={16} />
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default OutgoingRequestsSection;