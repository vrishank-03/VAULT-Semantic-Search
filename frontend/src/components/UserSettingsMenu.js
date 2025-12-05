// frontend/src/components/UserSettingsMenu.js
// New File

import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiChevronUp } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggleButton from './ThemeToggleButton'; // Importing the button to be used here
import useOnClickOutside from './dashboard/hooks/useOnClickOutside';

// A simple hook to detect clicks outside an element
// You can create this file: frontend/src/hooks/useOnClickOutside.js
/*
import { useEffect } from 'react';
export default function useOnClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) return;
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}
*/

const UserSettingsMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useOnClickOutside(menuRef, () => setIsMenuOpen(false));

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const UserAvatar = () => (
        user?.pictureUrl ? (
            <img
                src={user.pictureUrl}
                alt="User Avatar"
                className="w-10 h-10 rounded-full"
            />
        ) : (
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold text-lg">
                {user?.email ? user.email.charAt(0).toUpperCase() : '?'}
            </div>
        )
    );

    return (
        <div ref={menuRef} className="relative">
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, bottom: '100%', y: 10 }}
                        animate={{ opacity: 1, bottom: '100%', y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="absolute left-0 right-0 z-10 mb-2 w-full p-2 bg-white dark:bg-gray-700 rounded-lg shadow-xl border dark:border-gray-600"
                    >
                        <div className="flex items-center justify-between p-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Theme</span>
                            <ThemeToggleButton />
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-3 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md font-semibold transition-colors duration-200"
                        >
                            <FiLogOut className="mr-3" size={20} /> Logout
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center justify-between w-full p-2 space-x-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
                <div className="flex items-center space-x-3 min-w-0">
                    <UserAvatar />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate min-w-0">
                        {user?.email || 'User'}
                    </span>
                </div>
                <FiChevronUp className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isMenuOpen ? 'rotate-0' : 'rotate-180'}`} />
            </button>
        </div>
    );
};

export default UserSettingsMenu;