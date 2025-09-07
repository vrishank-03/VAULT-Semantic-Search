import React from 'react';
// This 'require' syntax is used to ensure the bundler can resolve the image path correctly.
const logo = require('../assets/logo.png');

const AuthLayout = ({ children }) => {
    return (
        // Main container: full screen, centers content, and hides overflow from the giant logo.
        <div className="relative min-h-screen w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden p-4">
            
            {/* Background Logo Element */}
            {/* This is the huge, blurred, semi-circle logo. */}
            {/* It's `fixed` to stay in place. */}
            {/* Positioned on the left edge and halfway off-screen to create the semi-circle. */}
            {/* `pointer-events-none` is crucial so you can click the form on top of it. */}
            <div
                className="fixed top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2 w-[120vh] h-[120vh] bg-no-repeat bg-center bg-contain opacity-5 dark:opacity-[0.02] pointer-events-none filter blur-xl"
                style={{ backgroundImage: `url(${logo})` }}
            ></div>

            {/* Content Container */}
            {/* `z-10` ensures this content (your login page) appears ON TOP of the background logo. */}
            <div className="relative z-10 w-full max-w-md">
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;