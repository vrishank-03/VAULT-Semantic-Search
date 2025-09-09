import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import Typewriter from '../components/Typewriter';
import GoogleLoginButton from '../components/GoogleLoginButton';
import Toast from '../Toast';
import logo from '../assets/logo.png';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';
import ProcessingAnimation from '../components/ProcessingAnimation'; // 1. Import the processing animation

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
    // State for login form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // State for forgot password form
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    // General state
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();
    
    const hasHandledRedirect = useRef(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const justVerified = searchParams.get('verified') === 'true';

        if ((location.state?.message || justVerified) && !hasHandledRedirect.current) {
            setToast({ message: location.state?.message || 'Email verified successfully! Please log in.', type: 'success' });
            hasHandledRedirect.current = true;
            window.history.replaceState({}, document.title, location.pathname);
        }

        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate, location.state, location.search, location.pathname]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setToast(null);

        const isEmailValid = emailRegex.test(email);
        if (!isEmailValid || !password) {
            setToast({ message: 'Please enter a valid email and password.', type: 'error' });
            return;
        }
        
        setIsLoading(true);
        try {
            await login({ email, password });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setToast(null);

        if (!emailRegex.test(resetEmail)) {
            setToast({ message: 'Please enter a valid email address.', type: 'error' });
            return;
        }

        setIsLoading(true); // Start loading animation
        try {
            await sendPasswordResetEmail(resetEmail);
            setSuccessMessage("Email Sent!");
            setShowSuccess(true);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false); // Stop loading animation
        }
    };

    const renderMainContent = () => {
        if (showSuccess) {
            return (
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Request Sent</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">If an account exists for {resetEmail}, a reset link has been sent.</p>
                    <GenericSuccessAnimation message={successMessage} />
                </div>
            );
        }

        if (isForgotPassword) {
            // 2. Add a check for the isLoading state here
            if (isLoading) {
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sending Email...</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Please wait a moment.</p>
                        <div className="my-6">
                            <ProcessingAnimation />
                        </div>
                    </div>
                );
            }

            return (
                <>
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Forgot Password</h2>
                    <form className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
                        <div>
                            <label htmlFor="reset-email-address" className="sr-only">Email address</label>
                            <input id="reset-email-address" name="email" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Enter your email address" />
                        </div>
                        <div>
                            {/* The button text change is now handled by the separate loading screen */}
                            <button type="submit" className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50">
                                Send Reset Link
                            </button>
                        </div>
                    </form>
                    <p className="!mt-6 text-sm text-center">
                        <button onClick={() => { setIsForgotPassword(false); setShowSuccess(false); setResetEmail(''); }} className="font-medium text-blue-600 hover:underline dark:text-blue-500">
                            Back to Login
                        </button>
                    </p>
                </>
            );
        }

        return (
            <>
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Log In to VAULT</h2>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input id="email-address" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Email address" />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Password" />
                    </div>
                    <div className="flex items-center justify-end">
                        <div className="text-sm">
                            <button type="button" onClick={() => { setIsForgotPassword(true); setToast(null); setEmail(''); setPassword(''); }} className="font-medium text-blue-600 hover:underline dark:text-blue-500">
                                Forgot your password?
                            </button>
                        </div>
                    </div>
                    <div>
                        <button type="submit" disabled={isLoading} className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>
                </form>
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-600" /></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-800/80 text-gray-500 dark:text-gray-400">Or continue with</span></div>
                </div>
                <GoogleLoginButton setError={(msg) => setToast({ message: msg, type: 'error' })} />
                <p className="!mt-6 text-sm text-center text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-500">Sign up</Link>
                </p>
            </>
        );
    };

    return (
        <AuthLayout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="flex flex-col items-center justify-center space-y-6">
                <img src={logo} alt="VAULT Logo" className="w-16 h-16" />
                <Typewriter initialSentence="Unlock Insights From Your Documents" className="font-black text-gray-800 dark:text-gray-200" />
                <div className="w-full max-w-md p-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-2xl dark:bg-gray-800/80">
                    {renderMainContent()}
                </div>
            </div>
        </AuthLayout>
    );
}

export default LoginPage;