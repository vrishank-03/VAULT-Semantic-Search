import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// [TASK 16] Removed googleLogin from imports
import { sendPasswordResetEmail, requestProductCreation } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import Typewriter from '../components/Typewriter';
// [TASK 16] Removed GoogleLoginButton import
import Toast from '../Toast';
import logo from '../assets/logo.png';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';
import ProcessingAnimation from '../components/ProcessingAnimation';

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

    // State for Set Product Modal
    const [isSetProductModalOpen, setIsSetProductModalOpen] = useState(false);
    const [productName, setProductName] = useState('');
    const [productOwnerName, setProductOwnerName] = useState('');
    const [productOwnerEmail, setProductOwnerEmail] = useState('');
    const [isProductLoading, setIsProductLoading] = useState(false);
    const [productSuccessMessage, setProductSuccessMessage] = useState(null);

    // General state
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();
    
    const hasHandledRedirect = useRef(false);

    useEffect(() => {
        console.log('[LOGIN_PAGE_EFFECT] useEffect running. Auth status:', isAuthenticated);
        
        if (isAuthenticated) {
            console.log('[LOGIN_PAGE_EFFECT] User is authenticated. Navigating to /dashboard.');
            navigate('/dashboard', { replace: true });
        }

        const searchParams = new URLSearchParams(location.search);
        const justVerified = searchParams.get('verified') === 'true';

        if ((location.state?.message || justVerified) && !hasHandledRedirect.current) {
            const message = location.state?.message || 'Email verified successfully! Please log in.';
            console.log(`[LOGIN_PAGE_EFFECT] Displaying toast from location state: ${message}`);
            setToast({ message, type: 'success' });
            hasHandledRedirect.current = true;
            window.history.replaceState({}, document.title, location.pathname);
        }
    }, [isAuthenticated, navigate, location.state, location.search, location.pathname]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setToast(null);
        console.log('[LOGIN_PAGE] handleLogin triggered.');

        const isEmailValid = emailRegex.test(email);
        if (!isEmailValid || !password) {
            console.warn('[LOGIN_PAGE] Login validation failed: Invalid email or missing password.');
            setToast({ message: 'Please enter a valid email and password.', type: 'error' });
            return;
        }
        
        console.log('[LOGIN_PAGE] Login form valid. Setting loading state.');
        setIsLoading(true);
        try {
            await login({ email, password });
            console.log('[LOGIN_PAGE] login() successful. useEffect will handle redirect.');
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
            console.error('[LOGIN_PAGE_ERROR] Login failed:', errorMessage);
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            console.log('[LOGIN_PAGE] Login attempt finished. Setting loading state to false.');
            setIsLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setToast(null);
        console.log('[LOGIN_PAGE] handleForgotPasswordSubmit triggered.');

        if (!emailRegex.test(resetEmail)) {
            console.warn('[LOGIN_PAGE] Forgot password validation failed: Invalid email.');
            setToast({ message: 'Please enter a valid email address.', type: 'error' });
            return;
        }

        console.log('[LOGIN_PAGE] Forgot password form valid. Setting loading state.');
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(resetEmail);
            console.log('[LOGIN_PAGE] sendPasswordResetEmail() successful.');
            setSuccessMessage("Email Sent!");
            setShowSuccess(true);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred.';
            console.error('[LOGIN_PAGE_ERROR] Forgot password failed:', errorMessage);
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            console.log('[LOGIN_PAGE] Forgot password attempt finished. Setting loading state to false.');
            setIsLoading(false);
        }
    };

    const handleSetProductSubmit = async (e) => {
        e.preventDefault();
        setToast(null);
        console.log('[SET_PRODUCT] Form submit initiated.');

        if (!productName || !productOwnerName || !productOwnerEmail) {
            console.warn('[SET_PRODUCT_WARN] Validation failed: Missing fields.');
            setToast({ message: 'All fields are required.', type: 'error' });
            return;
        }
        if (!emailRegex.test(productOwnerEmail)) {
            console.warn('[SET_PRODUCT_WARN] Validation failed: Invalid owner email.');
            setToast({ message: 'Please enter a valid Product Owner email.', type: 'error' });
            return;
        }

        console.log('[SET_PRODUCT] Validation passed. Setting loading state.');
        setIsProductLoading(true);
        setProductSuccessMessage(null);

        try {
            const payload = { productName, productOwnerName, productOwnerEmail };
            console.log('[SET_PRODUCT_API] Calling requestProductCreation with payload:', payload);
            
            const response = await requestProductCreation(payload);
            
            console.log('[SET_PRODUCT_API_SUCCESS] API call successful:', response);
            setProductSuccessMessage('Product request sent! The CTO has been notified for approval.');
            
            setProductName('');
            setProductOwnerName('');
            setProductOwnerEmail('');

        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to send product request.';
            console.error('[SET_PRODUCT_API_ERROR] API call failed:', errorMessage);
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            console.log('[SET_PRODUCT] API request finished. Setting loading state to false.');
            setIsProductLoading(false);
        }
    };

    const closeProductModal = () => {
        console.log('[SET_PRODUCT] Closing product modal.');
        setIsSetProductModalOpen(false);
        setProductName('');
        setProductOwnerName('');
        setProductOwnerEmail('');
        setIsProductLoading(false);
        setProductSuccessMessage(null);
        setToast(null);
    };

    const renderSetProductModal = () => {
        console.log(`[SET_PRODUCT] renderSetProductModal called. Loading: ${isProductLoading}, Success: ${productSuccessMessage}`);
        
        return (
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                onClick={closeProductModal}
            >
                <div 
                    className="relative w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-800"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={closeProductModal}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    {productSuccessMessage ? (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Request Sent</h2>
                            <GenericSuccessAnimation message={productSuccessMessage} />
                            <button 
                                onClick={closeProductModal}
                                className="mt-6 w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    ) : 
                    isProductLoading ? (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Submitting Request...</h2>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">Please wait a moment.</p>
                            <div className="my-6">
                                <ProcessingAnimation />
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Register a New Product</h2>
                            <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
                                Submit a request to add a new product. This will be sent to the CTO for approval.
                            </p>
                            <form className="space-y-6" onSubmit={handleSetProductSubmit}>
                                <div>
                                    <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
                                    <input id="product-name" name="product-name" type="text" required value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="e.g., Mercury FX" />
                                </div>
                                <div>
                                    <label htmlFor="owner-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Owner Name</label>
                                    <input id="owner-name" name="owner-name" type="text" required value={productOwnerName} onChange={(e) => setProductOwnerName(e.target.value)} className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="e.g., Jane Doe" />
                                </div>
                                <div>
                                    <label htmlFor="owner-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Owner Email</label>
                                    <input id="owner-email" name="owner-email" type="email" required value={productOwnerEmail} onChange={(e) => setProductOwnerEmail(e.target.value)} className="mt-1 relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="e.g., jane.doe@company.com" />
                                </div>
                                <div className="flex gap-4">
                                    <button type="button" onClick={closeProductModal} className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md group hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isProductLoading} className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50">
                                        Submit for Approval
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderMainContent = () => {
        if (showSuccess) {
            console.log('[LOGIN_PAGE] renderMainContent: showSuccess');
            return (
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Request Sent</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">If an account exists for {resetEmail}, a reset link has been sent.</p>
                    <GenericSuccessAnimation message={successMessage} />
                </div>
            );
        }

        if (isForgotPassword) {
            if (isLoading) {
                console.log('[LOGIN_PAGE] renderMainContent: isForgotPassword (Loading)');
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
            
            console.log('[LOGIN_PAGE] renderMainContent: isForgotPassword (Form)');
            return (
                <>
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Forgot Password</h2>
                    <form className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
                        <div>
                            <label htmlFor="reset-email-address" className="sr-only">Email address</label>
                            <input id="reset-email-address" name="email" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Enter your email address" />
                        </div>
                        <div>
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

        console.log('[LOGIN_PAGE] renderMainContent: Default (Login Form)');
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
                
                {/* --- [TASK 16] REMOVED DIVIDER AND GOOGLE LOGIN BUTTON --- */}

                <p className="!mt-6 text-sm text-center text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-500">Sign up</Link>
                </p>

                <p className="!mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
                    Need to register a new product?{' '}
                    <button 
                        type="button" 
                        onClick={() => {
                            console.log('[LOGIN_PAGE] "Set Product" button clicked, opening modal.');
                            setIsSetProductModalOpen(true);
                            setToast(null);
                        }} 
                        className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                        Set Product
                    </button>
                </p>
            </>
        );
    };

    return (
        <AuthLayout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {isSetProductModalOpen && renderSetProductModal()}

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