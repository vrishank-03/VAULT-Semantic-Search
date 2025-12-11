// frontend/src/pages/LoginPage.js
// [LAYOUT] Grid Logic updated: Logo (Top-Left), Text (Bottom-Left)
// [ANIMATION] Smooth concurrent transitions for text ("popLayout" vs "wait")

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail, requestProductCreation } from '../services/api';
import Toast from '../Toast';
import logo from '../assets/logo.png';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';
import ProcessingAnimation from '../components/ProcessingAnimation';
import SignatureAnimation from '../components/SignatureAnimation';
import { motion, AnimatePresence } from 'framer-motion';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- "Slide Up" Text Component (Refactored) ---
const AppleTextCycle = () => {
    const [index, setIndex] = useState(0);

    const sentences = [
        { pre: "From data to decisions,", highlight: "instantly." },
        { pre: "It's simple with", highlight: "Vault." }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            console.log(`[AppleTextCycle] Cycling text index: ${index} -> ${(index + 1) % sentences.length}`);
            setIndex((prev) => (prev + 1) % sentences.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [index]);

    return (
        <div className="flex flex-col items-start justify-end w-full">
            {/* [FIX] Mask Image: Adds a soft gradient fade to the top of the container. 
                This prevents the "choppy" cut-off when text slides up.
            */}
            <div
                className="h-32 relative w-full flex items-end justify-start overflow-hidden"
                style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 100%)' }}
            >
                {/* [FIX] mode="popLayout": Allows concurrent animations (smooth crossover) */}
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={index}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: "0%", opacity: 1 }}
                        exit={{ y: "-100%", opacity: 0, scale: 0.95 }}
                        transition={{
                            y: { type: "spring", stiffness: 50, damping: 20 },
                            opacity: { duration: 0.5 }
                        }}
                        className="absolute bottom-0 left-0 flex flex-col items-start text-left space-y-2 pb-2"
                    >
                        <span className="text-4xl md:text-5xl font-light tracking-wide text-zinc-300">
                            {sentences[index].pre}
                        </span>

                        <span className="text-5xl md:text-6xl font-semibold text-cyan-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                            {sentences[index].highlight}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- Page Variants ---
const formVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { delay: 0.2, duration: 0.6, ease: "easeOut" }
    }
};

function LoginPage() {
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

    useEffect(() => {
        console.log('[LoginPage] Component Mounted.');
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
        if (!emailRegex.test(email) || !password) {
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
            setProductSuccessMessage('Request sent! CTO notified.');
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to send request.';
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

    const renderSetProductModal = () => {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={closeProductModal}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-lg p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl font-inter text-zinc-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={closeProductModal} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">✕</button>
                    {productSuccessMessage ? (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-4 text-white">Request Sent</h2>
                            <GenericSuccessAnimation message={productSuccessMessage} />
                            <button onClick={closeProductModal} className="mt-6 w-full px-4 py-2 text-sm font-medium text-black bg-white rounded-lg hover:bg-zinc-200">Close</button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-center text-white">New Product Request</h2>
                            <p className="text-center text-zinc-400 text-sm">Approvals are routed to the CTO.</p>
                            <form className="space-y-4" onSubmit={handleSetProductSubmit}>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Product Name</label>
                                    <input type="text" required value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Mercury FX" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Owner Name</label>
                                    <input type="text" required value={productOwnerName} onChange={(e) => setProductOwnerName(e.target.value)} className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Jane Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Owner Email</label>
                                    <input type="email" required value={productOwnerEmail} onChange={(e) => setProductOwnerEmail(e.target.value)} className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="jane@company.com" />
                                </div>
                                <button type="submit" disabled={isProductLoading} className="w-full py-2.5 text-sm font-bold text-black bg-white rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50">
                                    {isProductLoading ? <ProcessingAnimation /> : 'Submit Request'}
                                </button>
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                    <h2 className="text-2xl font-bold mb-4 text-white">Request Sent</h2>
                    <p className="text-zinc-400 mb-6">If an account exists for {resetEmail}, a reset link has been sent.</p>
                    <GenericSuccessAnimation message={successMessage} />
                    <button onClick={() => { setShowSuccess(false); setIsForgotPassword(false); }} className="mt-6 text-sm text-cyan-400 hover:text-cyan-300">Back to Login</button>
                </motion.div>
            );
        }
        if (isForgotPassword) {
            return (
                <>
                    <h2 className="text-2xl font-semibold text-center text-white mb-2">Reset Password</h2>
                    <p className="text-zinc-400 text-sm text-center mb-8">We'll send you a link to get back in.</p>
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full px-4 py-3 bg-black/40 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all" placeholder="Enter your email" />
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-zinc-200 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)]">
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                        <div className="text-center mt-6">
                            <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-zinc-500 hover:text-white transition-colors">Cancel</button>
                        </div>
                    </form>
                </>
            );
        }
        return (
            <>
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
                    <p className="text-zinc-500 text-sm mt-3">Enter your credentials to access the vault.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2 ml-1">Email</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-black/40 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all" placeholder="name@company.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-black/40 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all" placeholder="••••••••" />
                        <div className="flex justify-end mt-2">
                            <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors">Forgot password?</button>
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-zinc-200 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]">
                        {isLoading ? <ProcessingAnimation /> : 'Sign In'}
                    </button>

                    <div className="pt-6 mt-6 border-t border-zinc-800 flex flex-col gap-4 text-center">
                        <p className="text-sm text-zinc-500">
                            Don't have an account? <Link to="/signup" className="text-white hover:underline decoration-zinc-500 underline-offset-4">Sign up</Link>
                        </p>
                        <button type="button" onClick={() => setIsSetProductModalOpen(true)} className="text-xs text-zinc-600 hover:text-cyan-500 transition-colors uppercase tracking-wider font-semibold">
                            Register New Product
                        </button>
                    </div>
                </form>
            </>
        );
    };

    return (
        <div className="flex min-h-screen w-full font-inter bg-zinc-950 overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {isSetProductModalOpen && renderSetProductModal()}

            {/* --- GLOBAL BACKGROUND --- */}
            {/* Signature Animation: Now anchored to top-left */}
            <div className="fixed inset-0 z-0">
                <SignatureAnimation />
            </div>

            {/* Grid & Vignette */}
            <div
                className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }}
            />
            <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_25%_35%,transparent_0%,#050505_90%)] pointer-events-none" />

            {/* --- LAYOUT GRID --- */}
            <div className="relative z-10 flex min-h-screen w-full">

                {/* --- LEFT PANEL: Logo & Text --- */}
                {/* [FIX] Layout Logic: justify-between pushes logo to top and text to bottom */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.5 }}
                    className="hidden lg:flex w-1/2 flex-col justify-between p-16"
                >
                    {/* 1. Anchored Logo (Top Left) */}
                    <div>
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 1 }}
                            src={logo}
                            alt="VAULT"
                            className="w-32 h-32 drop-shadow-[0_0_35px_rgba(6,182,212,0.5)]"
                        />
                    </div>

                    {/* 2. Text Content (Aligned Bottom Left) */}
                    <div className="w-full max-w-xl pb-12">
                        <AppleTextCycle />

                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2, duration: 1 }}
                            className="text-zinc-500 text-lg font-medium tracking-wide mt-6"
                        >
                            The single source of truth for your enterprise.
                        </motion.p>
                    </div>
                </motion.div>

                {/* --- RIGHT PANEL: Login Form --- */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                    <motion.div
                        variants={formVariants}
                        initial="hidden"
                        animate="visible"
                        className="w-full max-w-md relative"
                    >
                        <div className="p-8 md:p-10 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                            {/* Mobile Logo */}
                            <div className="lg:hidden text-center mb-8">
                                <img src={logo} alt="VAULT" className="w-20 h-20 mx-auto mb-4" />
                            </div>
                            {renderMainContent()}
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-zinc-700 text-[10px] tracking-[0.3em] uppercase font-bold">
                                Secured by Vault
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;