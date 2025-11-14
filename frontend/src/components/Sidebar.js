// frontend/src/components/Sidebar.js
// Corrected Refactor

import React from 'react';
import { useLayout } from '../context/LayoutContext';
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';
import UserSettingsMenu from './UserSettingsMenu';
import { FiMenu } from 'react-icons/fi'; // Import the menu icon

function Sidebar() {
    const { isSidebarOpen, sidebarContent, toggleSidebar } = useLayout();

    const sidebarVariants = {
        open: { 
            x: '0%',
            transition: { type: 'spring', stiffness: 400, damping: 40 }
        },
        closed: {
            x: '-100%',
            transition: { type: 'spring', stiffness: 400, damping: 40 }
        },
    };

    return (
        // This relative container holds both the button and the sidebar
        <div className="relative z-40">
            {/* --- Hamburger Button --- */}
            {/* This button is fixed to the viewport and DOES NOT animate its position */}
            <button
                onClick={toggleSidebar}
                className="fixed top-3 left-3 z-50 p-2 rounded-full text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                aria-label="Toggle sidebar"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
            >
                <FiMenu className="w-6 h-6" />
            </button>
            
            {/* --- Sidebar Content Panel --- */}
            <motion.div
                variants={sidebarVariants}
                animate={isSidebarOpen ? 'open' : 'closed'}
                className="flex flex-col justify-between fixed top-0 left-0 h-full bg-gray-100 dark:bg-gray-800 shadow-xl"
                style={{ width: '16rem' }} // w-64
            >
                {/* Wrapper to handle overflow and padding */}
                <div className="flex flex-col flex-grow p-6 overflow-hidden">
                    {/* Logo & Spacer for button */}
                    <div className="flex items-center space-x-3 mb-8 flex-shrink-0 pt-10">
                        <img src={logo} alt="VAULT Logo" className="w-8 h-8" />
                        <span className="text-xl font-bold text-gray-900 dark:text-white">VAULT</span>
                    </div>

                    {/* Context-Aware Content: Rendered from context */}
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        {sidebarContent}
                    </div>
                </div>

                {/* User Settings Menu */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                    <UserSettingsMenu />
                </div>
            </motion.div>
        </div>
    );
}

export default Sidebar;