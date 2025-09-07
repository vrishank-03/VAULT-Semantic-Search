import React from 'react';
import Typewriter from './Typewriter';
import logo from '../assets/logo.png';

const AuthLayout = ({ children }) => {
    return (
        <div className="min-h-screen font-sans antialiased text-gray-900 bg-gray-50">
            <div className="grid md:grid-cols-2 min-h-screen">
                {/* Left Side: Branding & Animation */}
                <div className="relative flex-col items-center justify-center hidden h-full bg-gray-900 md:flex">
                    {/* Blurred Background Logo */}
                    <img
                        src={logo}
                        alt="VAULT Logo Background"
                        className="absolute object-contain w-full h-full transform -translate-x-1/2 -translate-y-1/2 opacity-10 top-1/2 left-1/2 filter blur-3xl"
                    />

                    {/* Content */}
                    <div className="z-10 p-12 text-left">
                        <img src={logo} alt="VAULT Logo" className="w-16 h-16 mb-6" />
                        <h1 className="text-4xl font-bold text-white">
                            VAULT
                        </h1>
                        <div className="mt-2 text-xl font-medium text-gray-300 h-16">
                           <Typewriter text="Enterprise-Grade RAG Q&A System" />
                        </div>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="flex items-center justify-center w-full bg-white">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;