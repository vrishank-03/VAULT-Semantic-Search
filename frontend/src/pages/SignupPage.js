import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import SuccessAnimation from '../components/SuccessAnimation'; // Import the new component

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false); // --- New state to trigger the animation ---
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        
        setIsLoading(true);
        try {
            await register(email, password);
            
            // --- Success! Trigger the animation ---
            setIsSuccess(true); 

            // Wait for the animation to play, then navigate
            setTimeout(() => {
                navigate('/login', { state: { message: 'Signup successful! Please log in.' } });
            }, 2000); // 2-second delay

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to sign up. The email might already be in use.');
            setIsLoading(false); // Stop loading on failure
        }
        // No finally block needed here, as we only stop loading on error or after navigation
    };

    return (
        <AuthLayout>
            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-2xl dark:bg-gray-800/80 transition-all duration-300">
                {/* --- Conditional Rendering: Show Animation or Form --- */}
                {isSuccess ? (
                    <SuccessAnimation />
                ) : (
                    <>
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create Your Account</h2>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">Join VAULT to start securing your knowledge.</p>
                        </div>

                        {error && <p className="p-3 text-sm text-center text-red-800 bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400">{error}</p>}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                    required
                                    placeholder="name@company.com"
                                />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                    required
                                    placeholder="Must be at least 8 characters"
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-300 disabled:opacity-50"
                            >
                                {isLoading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>
                        <p className="mt-6 text-sm text-center text-gray-500 dark:text-gray-400">
                            Already have an account? <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-500">Login</Link>
                        </p>
                    </>
                )}
            </div>
        </AuthLayout>
    );
};

export default SignupPage;