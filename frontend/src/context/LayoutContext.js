// frontend/src/context/LayoutContext.js
// Corrected File

import React, { createContext, useState, useContext } from 'react';

const LayoutContext = createContext(null);

export const LayoutProvider = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    // --- [NEW] State for dynamic sidebar content ---
    const [sidebarContent, setSidebarContent] = useState(null);

    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    // --- [MODIFIED] Removed useMemo for stability ---
    // This value object will be passed to all consumers
    const value = {
        isSidebarOpen,
        toggleSidebar,
        sidebarContent,
        setSidebarContent, // Expose setter
    };

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};