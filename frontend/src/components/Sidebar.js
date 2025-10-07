import React from 'react';
import { FiPlus, FiLogOut } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
// 1. Import useAuth to get user data from the context
import { useAuth } from '../context/AuthContext'; 
import logo from '../assets/logo.png'; 

function Sidebar({ handleNewChat }) {
    const navigate = useNavigate();
    // 2. Get the user object and logout function directly from the context
    const { user, logout } = useAuth();

    const handleLogout = () => {
        // 3. Call the logout function from the context
        logout();
        navigate('/login'); 
    };

    return (
        <div className="flex flex-col justify-between w-64 bg-gray-100 dark:bg-gray-800 p-6 shadow-xl transition-colors duration-300">
            <div>
                <div className="flex items-center space-x-3 mb-8">
                    {/* Vault Logo - Now using your actual logo */}
                    <img src={logo} alt="VAULT Logo" className="w-8 h-8" />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">VAULT</span>
                </div>

                <button
                    onClick={handleNewChat}
                    className="flex items-center justify-center w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:-translate-y-0.5"
                >
                    <FiPlus className="mr-2" size={20} /> New Chat
                </button>
            </div>

            <div className="space-y-4">
                {/* User Profile Section - Now reads from the context's user object */}
                {user && user.email && (
                    <div className="flex items-center space-x-3 p-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                        {user.pictureUrl ? (
                            // If a picture URL exists, display it
                            <img
                                src={user.pictureUrl}
                                alt="User Avatar"
                                className="w-10 h-10 rounded-full"
                            />
                        ) : (
                            // Fallback for users without a Google picture
                            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold text-lg">
                                {user.email.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {user.email}
                        </span>
                    </div>
                )}
                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-semibold transition-colors duration-200"
                >
                    <FiLogOut className="mr-3" size={20} /> Logout
                </button>
            </div>
        </div>
    );
}

export default Sidebar;