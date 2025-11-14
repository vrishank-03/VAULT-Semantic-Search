// frontend/src/AppLayout.js
// Corrected Refactor

import React from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutProvider, useLayout } from './context/LayoutContext';
import Sidebar from './components/Sidebar';
import { motion } from 'framer-motion';

// Main content area that adjusts its margin based on sidebar state
const MainContent = () => {
    const { isSidebarOpen } = useLayout();

    return (
        <motion.div
            className="flex-grow flex flex-col"
            animate={{
                // 16rem = w-64 (sidebar)
                // 0rem = NO GAP when closed
                marginLeft: isSidebarOpen ? '16rem' : '0rem' 
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        >
            <main className="flex-grow overflow-y-auto">
                <Outlet />
            </main>
        </motion.div>
    );
};

const AppLayout = () => {
    return (
        <LayoutProvider>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-hidden">
                <Sidebar />
                <MainContent />
            </div>
        </LayoutProvider>
    );
};

export default AppLayout;