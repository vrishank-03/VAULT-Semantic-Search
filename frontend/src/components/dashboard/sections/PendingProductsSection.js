import React from 'react';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';

const PendingProductsSection = ({ pendingProducts, onApprove, onReject }) => {
    if (pendingProducts.length === 0) {
        return (
            <div className="mb-12">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Pending Product Approvals</h2>
                <p className="text-gray-500 dark:text-gray-400">There are no products awaiting approval.</p>
            </div>
        );
    }

    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Pending Product Approvals</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {pendingProducts.map((product) => (
                        <li key={product.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">{product.product_name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <strong>PO:</strong> {product.product_owner_name} ({product.product_owner_email})
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Requested: {new Date(product.created_at).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex-shrink-0 flex gap-2">
                                <button
                                    onClick={() => onReject(product.id, product.product_name)}
                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700"
                                >
                                    <FiXCircle size={16} />
                                    Reject
                                </button>
                                <button
                                    onClick={() => onApprove(product.id, product.product_name)}
                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700"
                                >
                                    <FiCheckCircle size={16} />
                                    Approve
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default PendingProductsSection;