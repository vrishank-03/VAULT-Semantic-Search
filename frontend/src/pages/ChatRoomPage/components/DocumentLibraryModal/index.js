// frontend/src/pages/ChatRoomPage/components/DocumentLibraryModal/index.js

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSearch, FiEye, FiTrash2 } from 'react-icons/fi';

const DocumentLibraryModal = ({ 
    isOpen, 
    onClose, 
    documents, 
    onView, 
    onDelete 
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDocs = useMemo(() => {
        return documents.filter(doc => 
            doc.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [documents, searchTerm]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative w-full max-w-2xl p-6 bg-white rounded-lg shadow-2xl dark:bg-gray-900"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Document Library ({documents.length})
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <FiX size={24} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="py-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search documents by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-3 pl-10 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Document Table */}
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Document Name</th>
                                        <th scope="col" className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDocs.length > 0 ? (
                                        filteredDocs.map((doc) => (
                                            <tr key={doc.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white truncate">
                                                    {doc.name}
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <button 
                                                        onClick={() => onView(doc)}
                                                        className="p-2 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="View Document"
                                                    >
                                                        <FiEye size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDelete(doc.id)}
                                                        className="p-2 text-red-600 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete Document"
                                                    >
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="2" className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                                                No documents found{searchTerm && ' matching your search'}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DocumentLibraryModal;