import { useState } from 'react';
import {
    approveProduct,
    rejectProduct,
    updateProduct
} from '../../../services/api';

export const useProductManagement = (setToast, refreshData) => {
    const [editingProductId, setEditingProductId] = useState(null);
    const [editFormData, setEditFormData] = useState({ productName: '', productOwnerName: '', productOwnerEmail: '' });

    const handleApproveProduct = async (productId, productName) => {
        console.log(`[useProductManagement] Attempting to approve product ID: ${productId}`);
        try {
            await approveProduct(productId);
            setToast({ message: `Product "${productName}" approved!`, type: 'success' });
            refreshData(); // Refresh all data
        } catch (error) {
            console.error(`[useProductManagement] Failed to approve product ${productId}:`, error);
            const errorMessage = error.response?.data?.message || 'Failed to approve product.';
            setToast({ message: errorMessage, type: 'error' });
        }
    };

    const handleRejectProduct = async (productId, productName) => {
        console.log(`[useProductManagement] Attempting to REJECT product ID: ${productId}`);
        if (!window.confirm(`Are you sure you want to REJECT and DELETE the product "${productName}"? This cannot be undone.`)) {
            console.log('[useProductManagement] Product rejection cancelled by user.');
            return;
        }

        try {
            await rejectProduct(productId);
            setToast({ message: `Product "${productName}" rejected.`, type: 'success' });
            refreshData(); // Refresh all data
        } catch (error) {
            console.error(`[useProductManagement] Failed to reject product ${productId}:`, error);
            const errorMessage = error.response?.data?.message || 'Failed to reject product.';
            setToast({ message: errorMessage, type: 'error' });
        }
    };

    const handleEditClick = (product) => {
        console.log(`[useProductManagement] Init edit for product ID: ${product.id}`);
        setEditingProductId(product.id);
        setEditFormData({
            productName: product.product_name,
            productOwnerName: product.product_owner_name,
            productOwnerEmail: product.product_owner_email
        });
    };

    const handleEditCancel = () => {
        console.log('[useProductManagement] Cancelled product edit.');
        setEditingProductId(null);
        setEditFormData({ productName: '', productOwnerName: '', productOwnerEmail: '' });
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleEditSave = async (productId) => {
        console.log(`[useProductManagement] Attempting to SAVE product ID: ${productId}`);
        if (!editFormData.productName || !editFormData.productOwnerName || !editFormData.productOwnerEmail) {
            setToast({ message: 'All fields are required.', type: 'error' });
            return;
        }
        try {
            await updateProduct(productId, {
                productName: editFormData.productName,
                productOwnerName: editFormData.productOwnerName,
                productOwnerEmail: editFormData.productOwnerEmail
            });
            setToast({ message: 'Product updated successfully!', type: 'success' });
            setEditingProductId(null);
            refreshData(); // Refresh all data
        } catch (error) {
            console.error(`[useProductManagement] Failed to update product ${productId}:`, error);
            const errorMessage = error.response?.data?.message || 'Failed to update product.';
            setToast({ message: errorMessage, type: 'error' });
        }
    };

    return {
        editingProductId,
        editFormData,
        handleApproveProduct,
        handleRejectProduct,
        handleEditClick,
        handleEditCancel,
        handleEditFormChange,
        handleEditSave
    };
};