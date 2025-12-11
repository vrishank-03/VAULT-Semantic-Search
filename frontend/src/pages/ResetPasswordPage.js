import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import Toast from '../Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';

// --- ICONS ---
const CheckIcon = () => (
    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const CircleIcon = () => (
    <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
);

const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    // Validation State
    const [checks, setChecks] = useState({
        length: false,
        lower: false,
        upper: false,
        number: false,
        special: false,
        match: false
    });

    useEffect(() => {
        if (!token) {
            navigate('/login', { state: { message: 'Invalid or missing password reset link.' } });
        }
    }, [token, navigate]);

    useEffect(() => {
        setChecks({
            length: password.length >= 8,
            lower: /[a-z]/.test(password),
            upper: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*]/.test(password),
            match: password.length > 0 && password === confirmPassword
        });
    }, [password, confirmPassword]);

    const isFormValid = Object.values(checks).every(Boolean);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setToast(null);

        if (!isFormValid) {
            setToast({ message: 'Please ensure all password requirements are met.', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            await resetPassword(token, password);
            setIsSuccess(true);
            setTimeout(() => {
                navigate('/login', { state: { message: 'Password updated successfully.' } });
            }, 2000);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Link expired or invalid.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const RequirementItem = ({ fulfilled, label }) => (
        <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-4 h-4 ${fulfilled ? '' : 'opacity-50'}`}>
                {fulfilled ? <CheckIcon /> : <CircleIcon />}
            </div>
            <span className={`text-xs transition-colors duration-200 ${fulfilled ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
                {label}
            </span>
        </div>
    );

    const renderContent = () => {
        if (isSuccess) {
            return (
                <div className="flex flex-col items-center justify-center py-10">
                    <GenericSuccessAnimation message="Password Set!" />
                </div>
            );
        }

        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <LoadingSpinner />
                    <p className="mt-4 text-sm text-gray-400">Updating credentials...</p>
                </div>
            );
        }

        return (
            <>
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Set new password</h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Choose a strong password to secure your account.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white placeholder-gray-700 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all sm:text-sm"
                                placeholder="Enter password"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`block w-full px-4 py-3 bg-[#0a0a0a] border rounded-lg text-white placeholder-gray-700 focus:outline-none focus:ring-1 transition-all sm:text-sm ${password && confirmPassword && password !== confirmPassword
                                    ? 'border-red-900 focus:border-red-600 focus:ring-red-600'
                                    : 'border-gray-800 focus:border-blue-600 focus:ring-blue-600'
                                    }`}
                                placeholder="Confirm password"
                            />
                        </div>
                    </div>

                    {/* Minimalist Checklist */}
                    <div className="pt-2">
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                            <RequirementItem fulfilled={checks.length} label="8+ characters" />
                            <RequirementItem fulfilled={checks.upper} label="Uppercase letter" />
                            <RequirementItem fulfilled={checks.lower} label="Lowercase letter" />
                            <RequirementItem fulfilled={checks.number} label="Number" />
                            <RequirementItem fulfilled={checks.special} label="Special character" />
                            <RequirementItem fulfilled={checks.match} label="Passwords match" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !isFormValid}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/10 mt-6"
                    >
                        Reset Password
                    </button>
                </form>
            </>
        );
    };

    return (
        <AuthLayout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="w-full max-w-[420px] mx-auto">
                {/* Single, clean card. No double layers. No footer text. */}
                <div className="bg-[#161616] border border-gray-800 rounded-xl shadow-2xl p-8">
                    {renderContent()}
                </div>
            </div>
        </AuthLayout>
    );
};

export default ResetPasswordPage;