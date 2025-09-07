import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Typewriter from '../components/Typewriter';
import GoogleLoginButton from '../components/GoogleLoginButton';
import Toast from '../Toast';
import logo from '../assets/logo.png';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();
    
    // Use a ref to track if we've already handled the redirect message
    const hasHandledRedirect = useRef(false);

    // This effect handles both the redirect message and auth status
    useEffect(() => {
        // Handle redirect message from signup
        if (location.state?.message && !hasHandledRedirect.current) {
            setToast({ message: location.state.message, type: 'success' });
            
            // Mark as handled to prevent re-triggering
            hasHandledRedirect.current = true;
            
            // Clean up the location state so the message doesn't reappear on refresh
            // We replace the history entry without causing a disruptive re-render
            window.history.replaceState({}, document.title);
        }

        // Handle redirecting if user is already authenticated
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate, location.state]);

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

    return (
        <AuthLayout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="flex flex-col items-center justify-center space-y-6">
                <img src={logo} alt="VAULT Logo" className="w-16 h-16" />
                <Typewriter 
                    initialSentence="Unlock Insights From Your Documents" 
                    className="font-black text-gray-800 dark:text-gray-200"
                />
                <div className="w-full max-w-md p-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-2xl dark:bg-gray-800/80">
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                        Log In to VAULT
                    </h2>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email address</label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                placeholder="Password"
                            />
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {isLoading ? 'Signing In...' : 'Sign In'}
                            </button>
                        </div>
                    </form>
                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white dark:bg-gray-800/80 text-gray-500 dark:text-gray-400">
                                Or continue with
                            </span>
                        </div>
                    </div>
                    <GoogleLoginButton setError={(msg) => setToast({ message: msg, type: 'error' })} />
                    <p className="!mt-6 text-sm text-center text-gray-600 dark:text-gray-400">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-500">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
}

export default LoginPage;