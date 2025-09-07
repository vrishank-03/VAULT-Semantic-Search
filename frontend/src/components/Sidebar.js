import React from 'react';
import { FiPlus, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
// CHANGE 1: Import the correct logo from the assets folder
import logo from '../assets/logo.png';

const Sidebar = ({ handleNewChat }) => {
    const { user, logout } = useAuth();

    return (
        // CHANGE 2: Updated background colors and added a border for a cleaner look in both modes.
        <div className="flex flex-col h-full w-64 bg-gray-50 dark:bg-black/20 p-4 border-r border-gray-200 dark:border-white/10">
            {/* Header */}
            <div className="flex items-center mb-8">
                {/* The new logo is used here */}
                <img src={logo} alt="VAULT Logo" className="w-8 h-8 mr-2" />
                {/* CHANGE 3: Made title text theme-aware */}
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">VAULT</h1>
            </div>

            {/* New Chat Button */}
            <button
                onClick={handleNewChat}
                className="flex items-center justify-center w-full px-4 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
            >
                <FiPlus className="mr-2" />
                New Chat
            </button>

            <div className="flex-grow">
                {/* Chat history can be mapped here in the future */}
            </div>

            {/* User Info & Logout */}
            <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 mr-3"></div>
                    {/* CHANGE 4: Made user email text theme-aware */}
                    <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{user?.email}</span>
                </div>
                <button
                    onClick={logout}
                    className="flex items-center w-full mt-4 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors duration-200"
                >
                    <FiLogOut className="mr-3" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;