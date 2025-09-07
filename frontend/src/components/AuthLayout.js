import React from 'react';
import ThemeToggleButton from './ThemeToggleButton'; // Import the toggle button

const logo = require('../assets/logo.png');

const AuthLayout = ({ children }) => {
    return (
        // Main container: full screen, centers content, and hides overflow.
        <div className="relative min-h-screen w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden p-4">
            
            {/* --- ADDED: Fixed Theme Toggle Button --- */}
            {/* `fixed` ensures it stays in place regardless of scrolling. */}
            {/* `z-50` ensures it stays on top of all other content. */}
            <div className="fixed top-6 right-6 z-50">
                <ThemeToggleButton />
            </div>

            {/* Background Logo Element */}
            <div
                className="fixed top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2 w-[120vh] h-[120vh] bg-no-repeat bg-center bg-contain opacity-5 dark:opacity-[0.02] pointer-events-none filter blur-xl"
                style={{ backgroundImage: `url(${logo})` }}
            ></div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-md">
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;