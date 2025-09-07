import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggleButton from './ThemeToggleButton'; // Import the theme toggle button

const Navbar = () => {
    const { isAuthenticated, user, logout } = useAuth();

    return (
        <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/dashboard" className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        VAULT
                    </Link>
                    <div className="flex items-center space-x-4">
                        <ThemeToggleButton />
                        {isAuthenticated ? (
                            <div className="flex items-center space-x-4">
                                <span className="text-gray-700 dark:text-gray-300 hidden sm:block">
                                    Welcome, {user.email}
                                </span>
                                <button
                                    onClick={logout}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div>
                                <Link
                                    to="/login"
                                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/signup"
                                    className="ml-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;