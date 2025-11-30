// frontend/src/pages/ChatRoomPage/components/DocumentLibraryModal/index.js
// --------------------------------------------------------
// [STYLE] "Enterprise Zinc" Theme - Clean Table Layout
// [FEATURE] Added "Copy Filename" button
// --------------------------------------------------------

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSearch, FiFileText, FiEye, FiTrash2, FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const DocumentLibraryModal = ({ isOpen, documents, onClose, onView, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    const filteredDocs = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCopyName = (id, name) => {
        navigator.clipboard.writeText(name);
        setCopiedId(id);
        toast.success("Filename copied");
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="
                        relative w-full max-w-2xl 
                        bg-white dark:bg-[#111] 
                        border border-zinc-200 dark:border-zinc-800 
                        rounded-xl shadow-2xl 
                        overflow-hidden
                        flex flex-col max-h-[80vh]
                    "
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300">
                                <FiFileText size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                                    Document Library
                                </h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {documents.length} {documents.length === 1 ? 'file' : 'files'} available
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <FiX size={20} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search documents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="
                                    w-full pl-10 pr-4 py-2.5 
                                    text-sm bg-zinc-50 dark:bg-zinc-900 
                                    border border-zinc-200 dark:border-zinc-700 
                                    rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500
                                    text-zinc-900 dark:text-zinc-100 placeholder-zinc-400
                                    transition-all
                                "
                            />
                        </div>
                    </div>

                    {/* Document List */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {filteredDocs.length > 0 ? (
                            <div className="space-y-1">
                                {filteredDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="
                                            group flex items-center justify-between p-3 
                                            rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 
                                            border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700
                                            transition-all duration-200
                                        "
                                    >
                                        {/* File Info */}
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="flex-shrink-0 w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold uppercase border border-blue-100 dark:border-blue-900/50">
                                                PDF
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate pr-4">
                                                    {doc.name}
                                                </p>
                                                {/* Optional: Add Upload Date here if available in doc object */}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Copy Name */}
                                            <button
                                                onClick={() => handleCopyName(doc.id, doc.name)}
                                                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                                                title="Copy Name"
                                            >
                                                {copiedId === doc.id ? <FiCheck size={16} className="text-green-500" /> : <FiCopy size={16} />}
                                            </button>

                                            {/* View */}
                                            <button
                                                onClick={() => onView(doc)}
                                                className="p-2 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                title="View Document"
                                            >
                                                <FiEye size={16} />
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => onDelete(doc.id)}
                                                className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <FiTrash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
                                <FiSearch size={32} className="mb-2 opacity-50" />
                                <p className="text-sm">No documents found</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 flex justify-between items-center">
                        <span>Supported formats: PDF, TXT</span>
                        <span>{filteredDocs.length} / {documents.length} showing</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DocumentLibraryModal;