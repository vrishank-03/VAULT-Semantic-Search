// frontend/src/context/LayoutContext.js
// --------------------------------------------------------
// [FIXED] Added missing sidebar toggle state to prevent crash
// [FIXED] Default state logic based on screen width
// --------------------------------------------------------

import React, { createContext, useContext, useState } from 'react';

const LayoutContext = createContext();

// Hook to consume the context
export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error("useLayout must be used within a LayoutProvider");
    }
    return context;
};

// Provider Component
export const LayoutProvider = ({ children }) => {
    // 1. Dynamic Sidebar Content (for injecting Chat History)
    const [sidebarContent, setSidebarContent] = useState(null);

    // 2. Sidebar Visibility State (The missing piece causing the crash)
    // Default: Open on Desktop (>= 768px), Closed on Mobile
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

    const value = {
        sidebarContent,
        setSidebarContent,
        isSidebarOpen,
        setIsSidebarOpen
    };

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
};