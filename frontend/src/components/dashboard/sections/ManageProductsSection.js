// frontend/src/components/dashboard/sections/ManageProductsSection.js

import React from 'react';
// --- [NEW] Import FiTrash2 ---
import { FiEdit2, FiSave, FiX, FiTrash2 } from 'react-icons/fi';

const ManageProductsSection = ({
    allProducts,
    editingProductId,
    editFormData,
    onEditClick,
    onEditCancel,
    onEditChange,
    onEditSave,
    onDeleteProduct // --- [NEW] Add prop ---
}) => {
    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Manage All Products</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {allProducts.length === 0 && (
                        <li className="p-4 text-gray-500 dark:text-gray-400">No products found.</li>
                    )}
                    {allProducts.map((product) => (
                        <li key={product.id} className="p-4">
                            {editingProductId === product.id ? (
                                // --- Edit Mode ---
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
                                        <input
                                            type="text"
                                            name="productName"
                                            value={editFormData.productName}
                                            onChange={onEditChange}
                                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Owner Name</label>
                                        <input
                                            type="text"
                                            name="productOwnerName"
                                            value={editFormData.productOwnerName}
                                            onChange={onEditChange}
                                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Owner Email</label>
                                        <input
                                            type="email"
                                            name="productOwnerEmail"
                                            value={editFormData.productOwnerEmail}
                                            onChange={onEditChange}
                                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    {/* --- [NEW] Button container --- */}
                                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                        <button
                                            onClick={() => onDeleteProduct(product.id, product.product_name)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700"
                                        >
                                            <FiTrash2 size={16} />
                                            Delete
                                        </button>
                                        <div className="flex-grow sm:flex-grow-0"></div> {/* Spacer */}
                                        <button
                                            onClick={onEditCancel}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 border border-transparent rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-500"
                                        >
                                            <FiX size={16} />
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => onEditSave(product.id)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                                        >
                                            <FiSave size={16} />
                                            Save
                                        </button>
                                    </div>
                                    {/* --- [END NEW] --- */}
                                </div>
                            ) : (
                                // --- Display Mode ---
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{product.product_name}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            <strong>PO:</strong> {product.product_owner_name} ({product.product_owner_email})
                                        </p>
                                        <p className="text-sm mt-1">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                product.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                                (product.status === 'pending' || product.status === 'awaiting_po_activation') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                            }`}>
                                                {(product.status === 'pending' || product.status === 'awaiting_po_activation') ? 'Pending' : product.status}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {(product.status === 'confirmed' || product.status === 'awaiting_po_activation') && (
                                            <button
                                                onClick={() => onEditClick(product)}
                                                className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                                            >
                                                <FiEdit2 size={16} />
                                                Edit
                                            </button>
                                        )}
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