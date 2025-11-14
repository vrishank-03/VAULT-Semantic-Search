// frontend/src/pages/LoginPage.js
// Corrected Refactor

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail, requestProductCreation } from '../services/api';
import Typewriter from '../components/Typewriter';
import Toast from '../Toast';
import logo from '../assets/logo.png';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';
import ProcessingAnimation from '../components/ProcessingAnimation';
import { motion } from 'framer-motion';

// --- [MODIFIED] Imports for particle animation ---
import Particles from "react-tsparticles";
// --- THIS IS THE FIX ---
import { loadSlim } from "tsparticles-slim"; 
// --- (We are using loadSlim instead of loadFull) ---

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- [Animation variants - UNCHANGED] ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delay: 0.1,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

function LoginPage() {
    // --- [All state and logic hooks are 100% UNCHANGED] ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [isSetProductModalOpen, setIsSetProductModalOpen] = useState(false);
    const [productName, setProductName] = useState('');
    const [productOwnerName, setProductOwnerName] = useState('');
    const [productOwnerEmail, setProductOwnerEmail] = useState('');
    const [isProductLoading, setIsProductLoading] = useState(false);
    const [productSuccessMessage, setProductSuccessMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();
    const hasHandledRedirect = useRef(false);

    // --- [MODIFIED] Particle system initialization ---
    const particlesInit = useCallback(async (engine) => {
        console.log(engine);
        // This loads the "slim" bundle, keeping it lightweight
        await loadSlim(engine);
    }, []);

    // --- [Particle options - UNCHANGED] ---
    const particlesOptions = useMemo(() => ({
        background: {
            color: {
                value: "transparent", // Will sit on top of our gradient
            },
        },
        fpsLimit: 60,
        interactivity: {
            events: {
                onHover: {
                    enable: true,
                    mode: "repulse", // This makes particles move away from mouse
                },
                resize: true,
            },
            modes: {
                repulse: {
                    distance: 100,
                    duration: 0.4,
                },
            },
        },
        particles: {
            color: {
                value: "#ffffff",
            },
            links: {
                color: "#ffffff",
                distance: 150,
                enable: true,
                opacity: 0.2, // Very subtle links
                width: 1,
            },
            move: {
                direction: "none",
                enable: true,
                outModes: "out",
                random: false,
                speed: 0.3, // Very slow, elegant movement
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                    area: 800,
                },
                value: 80, // Number of particles
            },
            opacity: {
                value: 0.3, // Subtle particles
            },
            shape: {
                type: "circle",
            },
            size: {
                value: { min: 1, max: 3 },
            },
        },
        detectRetina: true,
    }), []);

    // --- [All useEffect and handler functions are 100% UNCHANGED] ---
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
        const searchParams = new URLSearchParams(location.search);
        const justVerified = searchParams.get('verified') === 'true';
        if ((location.state?.message || justVerified) && !hasHandledRedirect.current) {
            const message = location.state?.message || 'Email verified successfully! Please log in.';
            setToast({ message, type: 'success' });
            hasHandledRedirect.current = true;
            window.history.replaceState({}, document.title, location.pathname);
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
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(resetEmail);
            setSuccessMessage("Email Sent!");
            setShowSuccess(true);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetProductSubmit = async (e) => {
        e.preventDefault();
        setToast(null);
        if (!productName || !productOwnerName || !productOwnerEmail) {
            setToast({ message: 'All fields are required.', type: 'error' });
            return;
        }
        if (!emailRegex.test(productOwnerEmail)) {
            setToast({ message: 'Please enter a valid Product Owner email.', type: 'error' });
            return;
        }
        setIsProductLoading(true);
        setProductSuccessMessage(null);
        try {
            const payload = { productName, productOwnerName, productOwnerEmail };
            await requestProductCreation(payload);
            setProductSuccessMessage('Product request sent! The CTO has been notified for approval.');
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to send product request.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsProductLoading(false);
        }
    };

    const closeProductModal = () => {
        setIsSetProductModalOpen(false);
        setProductName('');
        setProductOwnerName('');
        setProductOwnerEmail('');
        setIsProductLoading(false);
        setProductSuccessMessage(null);
        setToast(null);
    };

    // --- [Modal Functions - UNCHANGED] ---
    const renderSetProductModal = () => {
        return (
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4"
                onClick={closeProductModal}
            >
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-2xl dark:bg-gray-800 font-inter"
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
                </motion.div>
            </div>
        );
    };

    const renderMainContent = () => {
        if (showSuccess) {
            return (
                <motion.div variants={itemVariants} className="text-center">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Request Sent</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">If an account exists for {resetEmail}, a reset link has been sent.</p>
                    <GenericSuccessAnimation message={successMessage} />
                </motion.div>
            );
        }
        if (isForgotPassword) {
            return (
                <>
                    <motion.h2 variants={itemVariants} className="text-3xl font-bold text-center text-gray-900 dark:text-white">Forgot Password</motion.h2>
                    <motion.form variants={itemVariants} className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
                        <div>
                            <label htmlFor="reset-email-address" className="sr-only">Email address</label>
                            <input id="reset-email-address" name="email" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="font-inter relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Enter your email address" />
                        </div>
                        <div>
                            <button type="submit" className="font-inter relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 disabled:opacity-50">
                                Send Reset Link
                            </button>
                        </div>
                    </motion.form>
                    <motion.p variants={itemVariants} className="!mt-6 text-sm text-center">
                        <button onClick={() => { setIsForgotPassword(false); setShowSuccess(false); setResetEmail(''); }} className="font-medium text-blue-600 hover:underline dark:text-blue-500 font-inter">
                            Back to Login
                        </button>
                    </motion.p>
                </>
            );
        }
        return (
            <>
                <motion.h2 variants={itemVariants} className="text-3xl font-bold text-center text-gray-900 dark:text-white">Log In to VAULT</motion.h2>
                <motion.form variants={itemVariants} className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input id="email-address" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="font-inter relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Email address" />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="font-inter relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Password" />
                    </div>
                    <div className="flex items-center justify-end">
                        <div className="text-sm">
                            <button type="button" onClick={() => { setIsForgotPassword(true); setToast(null); setEmail(''); setPassword(''); }} className="font-medium text-blue-600 hover:underline dark:text-blue-500 font-inter">
                                Forgot your password?
                            </button>
                        </div>
                    </div>
                    <div>
                        <button type="submit" disabled={isLoading} className="font-inter relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>
                </motion.form>
                
                <motion.p variants={itemVariants} className="!mt-6 text-sm text-center text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-500">Sign up</Link>
                </motion.p>
                <motion.p variants={itemVariants} className="!mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
                    Need to register a new product?{' '}
                    <button 
                        type="button" 
                        onClick={() => { setIsSetProductModalOpen(true); setToast(null); }} 
                        className="font-medium text-blue-600 hover:underline dark:text-blue-500 font-inter"
                    >
                        Set Product
                    </button>
                </motion.p>
            </>
        );
    };

    // --- [Layout return statement - UNCHANGED] ---
    return (
        <div className="flex min-h-screen font-inter bg-gray-100 dark:bg-gray-900">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {isSetProductModalOpen && renderSetProductModal()}

            <motion.div 
                className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white relative"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                {/* --- Particle Animation Background --- */}
                <Particles
                    id="tsparticles"
                    init={particlesInit}
                    options={particlesOptions}
                    className="absolute top-0 left-0 w-full h-full z-0"
                />

                <div className="relative z-10 flex flex-col items-center justify-center">
                    <img src={logo} alt="VAULT Logo" className="w-24 h-24 mb-6" />
                    <Typewriter initialSentence="From data to decisions, instantly." />
                    <p className="text-lg text-gray-400 mt-4 max-w-md text-center font-medium">
                        The single source of truth for your enterprise, powered by AI.
                    </p>
                </div>
            </motion.div>

            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <motion.div 
                    className="w-full max-w-md"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.img 
                        src={logo} 
                        alt="VAULT Logo" 
                        className="w-16 h-16 mx-auto mb-6 lg:hidden" 
                        variants={itemVariants}
                    />
                    
                    <div className="p-8 space-y-6 bg-white rounded-xl shadow-2xl dark:bg-gray-800">
                        {renderMainContent()}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default LoginPage;