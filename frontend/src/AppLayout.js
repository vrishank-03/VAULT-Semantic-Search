// frontend/src/AppLayout.js
// --------------------------------------------------------
// [FIXED] Changed 'overflow-hidden' to 'overflow-y-auto' on <main>
// [RESULT] Dashboard can now scroll vertically.
// --------------------------------------------------------

import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { LayoutProvider } from './context/LayoutContext';

const AppLayout = () => {
    return (
        <LayoutProvider>
            {/* PARENT CONTAINER 
                - flex: Establishes the row direction (Sidebar | Content)
                - h-screen/w-screen: Locks to viewport size
                - overflow-hidden: Prevents BODY scrollbars (we want internal scrolling)
                - bg-[#1e1e1e]: Dark background base
            */}
            <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA] dark:bg-[#1e1e1e]">

                {/* SIDEBAR 
                   Stays static on the left.
                */}
                <Sidebar />

                {/* MAIN CONTENT 
                   - flex-1: Takes up ALL remaining width
                   - min-w-0: Prevents flexbox overflow bugs
                   - overflow-y-auto: [CRITICAL FIX] Enables vertical scrolling for the content
                   - relative: Establishes context for absolute headers/modals
                */}
                <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-y-auto custom-scrollbar">
                    <Outlet />
                </main>

            </div>
        </LayoutProvider>
    );
};

export default AppLayout;