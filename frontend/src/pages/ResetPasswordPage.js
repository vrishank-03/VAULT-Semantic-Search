import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import Toast from '../Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';

// Re-using the same validation logic from Signup
const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push("at least 8 characters");
    if (!/[a-z]/.test(password)) errors.push("a lowercase letter");
    if (!/[A-Z]/.test(password)) errors.push("an uppercase letter");
    if (!/\d/.test(password)) errors.push("a number");
    if (!/[!@#$%^&*]/.test(password)) errors.push("a special character (!@#$%^&*)");
    return errors;
};

const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            navigate('/login', { state: { message: 'Invalid or missing password reset link.' } });
        }
    }, [token, navigate]);

    useEffect(() => {
        setPasswordErrors(password ? validatePassword(password) : []);
    }, [password]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setToast(null);

        if (password !== confirmPassword) {
            setToast({ message: 'Passwords do not match.', type: 'error' });
            return;
        }

        const validationErrors = validatePassword(password);
        if (validationErrors.length > 0) {
            setToast({ message: `Password is not strong enough.`, type: 'error' });
            return;
        }
        
        setIsLoading(true);
        try {
            await resetPassword(token, password);
            setIsSuccess(true);
            setTimeout(() => {
                navigate('/login', { state: { message: 'Password updated successfully! Please log in.' } });
            }, 2500); // Wait for animation
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to reset password. The link may be expired.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        if (isSuccess) {
            return (
                <div className="text-center">
                    <GenericSuccessAnimation message="Password Updated!" />
                </div>
            );
        }

        if (isLoading) {
            return (
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Updating Password...</h2>
                    <div className="my-6">
                        <LoadingSpinner />
                    </div>
                </div>
            );
        }

        return (
            <>
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create a New Password</h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Your new password must be different from previous passwords.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter new password" className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                     {password.length > 0 && passwordErrors.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                            <ul className="list-disc list-inside">
                                {validatePassword("").map(rule => (
                                    <li key={rule} className={!passwordErrors.includes(rule) ? 'text-green-500 line-through' : ''}>{rule}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                    <button type="submit" disabled={isLoading || (password.length > 0 && passwordErrors.length > 0) || password !== confirmPassword} className="w-full py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        Reset Password
                    </button>
                </form>
            </>
        );
    };

    return (
        <AuthLayout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-2xl dark:bg-gray-800/80 transition-all duration-300">
                {renderContent()}
            </div>
        </AuthLayout>
    );
};

export default ResetPasswordPage;