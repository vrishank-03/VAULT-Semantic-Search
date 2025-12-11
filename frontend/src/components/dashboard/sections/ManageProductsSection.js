// frontend/src/components/dashboard/sections/ManageProductsSection.js

import React from 'react';
import { FiEdit2, FiSave, FiX, FiTrash2, FiBox } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext'; // Import Auth to check role

const ManageProductsSection = ({
    allProducts = [], // Default to empty array
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
        <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FiBox />
                {isPO ? "My Product" : "Manage All Products"}
            </h2>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(!allProducts || allProducts.length === 0) && (
                        <li className="p-8 text-center text-gray-500 dark:text-gray-400">
                            {isPO
                                ? "You don't have a product assigned yet. Please wait for the CEO to assign one."
                                : "No products found."}
                        </li>
                    )}

                    {allProducts?.map((product) => (
                        <li key={product.id} className="p-4 transition hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {editingProductId === product.id ? (
                                // --- Edit Mode ---
                                <div className="space-y-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Product Name</label>
                                            <input
                                                type="text"
                                                name="productName"
                                                value={editFormData.productName}
                                                onChange={onEditChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        {/* Only Admin/CEO can edit Owner details, usually. Keeping it enabled for now based on your code */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">PO Name</label>
                                            <input
                                                type="text"
                                                name="productOwnerName"
                                                value={editFormData.productOwnerName}
                                                onChange={onEditChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">PO Email</label>
                                            <input
                                                type="email"
                                                name="productOwnerEmail"
                                                value={editFormData.productOwnerEmail}
                                                onChange={onEditChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
                                        <button
                                            onClick={() => onDeleteProduct(product.id, product.product_name)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/40"
                                        >
                                            <FiTrash2 size={16} /> Delete
                                        </button>
                                        <div className="flex-grow sm:flex-grow-0"></div>
                                        <button
                                            onClick={onEditCancel}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                                        >
                                            <FiX size={16} /> Cancel
                                        </button>
                                        <button
                                            onClick={() => onEditSave(product.id)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                                        >
                                            <FiSave size={16} /> Save Changes
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // --- Display Mode ---
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product.product_name}</h3>
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${product.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                                (product.status === 'pending' || product.status === 'awaiting_po_activation') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {(product.status === 'pending' || product.status === 'awaiting_po_activation') ? 'Pending Activation' : product.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            Owner: <span className="font-medium text-gray-700 dark:text-gray-300">{product.product_owner_name}</span> ({product.product_owner_email})
                                        </p>
                                    </div>

                                    <div className="flex-shrink-0">
                                        <button
                                            onClick={() => onEditClick(product)}
                                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <FiEdit2 size={16} />
                                            {isPO ? "Edit Details" : "Manage"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ManageProductsSection;