// frontend/src/components/dashboard/sections/ManageProductsSection.js

import React from 'react';
import { FiEdit2, FiSave, FiX, FiTrash2, FiBox, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';

const ManageProductsSection = ({
    allProducts = [],
    editingProductId,
    editFormData,
    onEditClick,
    onEditCancel,
    onEditChange,
    onEditSave,
    onDeleteProduct
}) => {
    const { user } = useAuth();
    const isPO = user?.role === 'po';

    return (
        // [LAYOUT FIX] Removed 'mx-auto' (centering) to align left with the dashboard title.
        // Increased max-width to 'max-w-6xl' for better spacing.
        <div className="w-full max-w-6xl mb-12">

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <FiBox className="w-6 h-6 text-zinc-900 dark:text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {isPO ? "My Product" : "Manage Products"}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {isPO ? "View and update your product details." : "Oversee all system products and assignments."}
                    </p>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">

                {/* Empty State */}
                {(!allProducts || allProducts.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-900 mb-4">
                            <FiAlertCircle className="w-8 h-8 text-zinc-400" />
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">No products found.</p>
                        {isPO && <p className="text-xs text-zinc-500 mt-1">Please wait for admin assignment.</p>}
                    </div>
                )}

                {/* List */}
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {allProducts?.map((product) => (
                        <li key={product.id} className="group">
                            {editingProductId === product.id ? (
                                // --- EDIT MODE ---
                                // [COLOR FIX] Strictly Neutral Grays (bg-zinc-50 / bg-zinc-900). No Blue/Purple tints.
                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-l-4 border-zinc-500 dark:border-zinc-500">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4">
                                        Editing Product
                                    </h3>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        {/* Product Name */}
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                                                Product Name
                                            </label>
                                            <input
                                                type="text"
                                                name="productName"
                                                value={editFormData.productName}
                                                onChange={onEditChange}
                                                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>

                                        {/* PO Name */}
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                                                PO Name
                                            </label>
                                            <input
                                                type="text"
                                                name="productOwnerName"
                                                value={editFormData.productOwnerName}
                                                onChange={onEditChange}
                                                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>

                                        {/* PO Email */}
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                                                PO Email
                                            </label>
                                            <input
                                                type="email"
                                                name="productOwnerEmail"
                                                value={editFormData.productOwnerEmail}
                                                onChange={onEditChange}
                                                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                        <button
                                            onClick={() => onDeleteProduct(product.id, product.product_name)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <FiTrash2 /> Delete
                                        </button>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={onEditCancel}
                                                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => onEditSave(product.id)}
                                                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                                            >
                                                <FiSave /> Save Changes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // --- VIEW MODE ---
                                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                                {product.product_name}
                                            </h3>
                                            <StatusBadge status={product.status} />
                                        </div>
                                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                                                PO: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{product.product_owner_name}</span>
                                            </span>
                                            <span className="hidden sm:inline mx-2 text-zinc-300 dark:text-zinc-700">|</span>
                                            <span className="block sm:inline mt-1 sm:mt-0">{product.product_owner_email}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onEditClick(product)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-all shadow-sm"
                                    >
                                        <FiEdit2 size={16} />
                                        <span>Edit</span>
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

// Helper for Status Pills
const StatusBadge = ({ status }) => {
    const styles = {
        confirmed: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20",
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
        awaiting_po_activation: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
        default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
    };

    const key = Object.keys(styles).includes(status) ? status : 'default';
    const label = status === 'awaiting_po_activation' ? 'Pending PO' : status;

    return (
        <span className={`px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wide rounded-full border ${styles[key]}`}>
            {label}
        </span>
    );
};

export default ManageProductsSection;