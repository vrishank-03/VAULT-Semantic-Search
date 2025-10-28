import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signupUser, checkVerificationStatus } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import SuccessAnimation from '../components/SuccessAnimation';
import GoogleLoginButton from '../components/GoogleLoginButton';
import Toast from '../Toast';
// CHANGED: Import the new LoadingSpinner
import LoadingSpinner from '../components/LoadingSpinner';

const validatePassword = (password) => {
    // ... (validation logic remains the same)
    const errors = [];
    if (password.length < 8) errors.push("at least 8 characters");
    if (!/[a-z]/.test(password)) errors.push("a lowercase letter");
    if (!/[A-Z]/.test(password)) errors.push("an uppercase letter");
    if (!/\d/.test(password)) errors.push("a number");
    if (!/[!@#$%^&*]/.test(password)) errors.push("a special character (!@#$%^&*)");
    return errors;
};

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [toast, setToast] = useState(null);
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const [step, setStep] = useState('form');

    useEffect(() => {
        let intervalId;
        if (step === 'verifying') {
            intervalId = setInterval(async () => {
                try {
                    const response = await checkVerificationStatus(email);
                    if (response.data.isVerified) {
                        setStep('verified');
                        clearInterval(intervalId);
                        setTimeout(() => {
                            navigate('/login', { state: { message: 'Verification successful! Please log in.' } });
                        }, 2000);
                    }
                } catch (err) {
                    console.log("Polling for verification status...");
                }
            }, 5000);
        }
        return () => clearInterval(intervalId);
    }, [step, email, navigate]);

    useEffect(() => {
        setPasswordErrors(password ? validatePassword(password) : []);
    }, [password]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setToast(null);
        const validationErrors = validatePassword(password);
        if (validationErrors.length > 0) {
            setToast({ message: `Password is missing: ${validationErrors.join(', ')}.`, type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            await signupUser({ email, password });
            setIsLoading(false);
            setStep('verifying');
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to sign up. The email might already be in use.';
            setToast({ message: errorMessage, type: 'error' });
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        switch (step) {
            case 'verifying':
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Check Your Inbox</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            A verification link has been sent to <br />
                            <strong className="text-blue-600 dark:text-blue-400">{email}</strong>.
                        </p>
                        <div className="my-6">
                            {/* CHANGED: Use the new LoadingSpinner */}
                            <LoadingSpinner />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            This screen will update automatically after you verify.
                        </p>
                    </div>
                );
            case 'verified':
                return (
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-green-500 dark:text-green-400">Email Verified!</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Redirecting you to login...</p>
                        <SuccessAnimation />
                    </div>
                );
            case 'form':
            default:
                return (
                    <>
                        {/* The form JSX remains exactly the same */}
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create Your Account</h2>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">Join VAULT to start securing your knowledge.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Create a strong password" className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                            </div>
                            {password.length > 0 && passwordErrors.length > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                                    <p className="font-medium">Password must contain:</p>
                                    <ul className="list-disc list-inside">
                                        {validatePassword("").map(rule => (
                                            <li key={rule} className={!passwordErrors.includes(rule) ? 'text-green-500 line-through' : ''}>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <button type="submit" disabled={isLoading || (password.length > 0 && passwordErrors.length > 0)} className="w-full py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isLoading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-600" /></div>
                            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-800/80 text-gray-500 dark:text-gray-400">Or</span></div>
                        </div>
                        <GoogleLoginButton setError={(msg) => setToast({ message: msg, type: 'error' })} />
                        <p className="!mt-6 text-sm text-center text-gray-500 dark:text-gray-400">
                            Already have an account? <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-500">Login</Link>
                        </p>
                    </>
                );
        }
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

export default SignupPage;