// frontend/src/components/Sidebar.js
// --------------------------------------------------------
// [UX FIX] Added "Typewriter Effect" to Sidebar Titles
// [UX] Titles now animate smoothly from "New Chat" -> "Real Name"
// [FIX] Added Static Management Links for PO/CEO/Admin
// --------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
    FiMenu, FiX, FiHome, FiLogOut, FiSettings, FiGrid, FiChevronLeft,
    FiUsers, FiActivity, FiLayers // Added Icons for Management
} from 'react-icons/fi';
import { useLayout } from '../context/LayoutContext';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

// --- SUB-COMPONENT: Typing Title ---
const TypingTitle = ({ title, isActive }) => {
    const [display, setDisplay] = useState(title);
    const hasMounted = useRef(false);

    useEffect(() => {
        if (!hasMounted.current) {
            setDisplay(title);
            hasMounted.current = true;
            return;
        }
        if (title === display) return;

        let i = 0;
        const targetTitle = title;
        setDisplay("");

        const interval = setInterval(() => {
            setDisplay(targetTitle.substring(0, i + 1));
            i++;
            if (i === targetTitle.length) {
                clearInterval(interval);
            }
        }, 30);

        return () => clearInterval(interval);
    }, [title]);

    return <span className="truncate">{display || title}</span>;
};


const Sidebar = () => {
    const { sidebarContent, isSidebarOpen, setIsSidebarOpen } = useLayout();
    const { logout, user } = useAuth(); // [FIX] Get user to check roles
    const location = useLocation();

    // Check Roles
    const userRole = user?.role?.toLowerCase();
    const canManage = ['admin', 'ceo', 'po'].includes(userRole);
    const isPO = userRole === 'po';

    const sidebarVariants = {
        open: { width: '16rem', transition: { type: 'spring', stiffness: 300, damping: 30 } },
        closed: { width: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    };

    return (
        <>
            {/* 1. GLOBAL TOGGLE */}
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed top-4 left-4 z-50 p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-transparent rounded-md transition-colors"
                    title="Open Sidebar"
                >
                    <FiMenu size={24} />
                </button>
            )}

            {/* 2. SIDEBAR CONTAINER */}
            <AnimatePresence mode="wait">
                {(isSidebarOpen || window.innerWidth >= 768) && (
                    <motion.div
                        initial={window.innerWidth < 768 ? "closed" : false}
                        animate={isSidebarOpen ? "open" : "closed"}
                        variants={sidebarVariants}
                        className="fixed inset-y-0 left-0 z-40 bg-[#FAFAFA] dark:bg-[#111] border-r border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xl md:shadow-none md:static md:h-screen overflow-hidden whitespace-nowrap"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] min-w-[16rem]">
                            <Link to="/dashboard" className="flex items-center gap-3">
                                <img src={logo} alt="Vault Logo" className="h-8 w-auto object-contain" />
                                <span className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100">VAULT</span>
                            </Link>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                <FiChevronLeft size={20} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-grow flex flex-col bg-[#FAFAFA] dark:bg-[#111] min-w-[16rem] overflow-y-auto">

                            {/* [FIX] ALWAYS Show Dashboard/Home Link at top */}
                            <div className="p-3 pb-0">
                                <Link
                                    to="/dashboard"
                                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${location.pathname === '/dashboard'
                                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                                        }`}
                                >
                                    <FiHome className="mr-3" size={16} />
                                    Dashboard
                                </Link>
                            </div>

                            {/* [FIX] Management Section (Visible to PO/CEO/Admin) */}
                            {canManage && (
                                <div className="px-3 pt-4">
                                    <div className="px-3 pb-2">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Management</p>
                                    </div>

                                    <Link to="/users" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all">
                                        <FiUsers className="mr-3" size={16} />
                                        Manage Users
                                    </Link>

                                    <Link to="/jit-requests" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all">
                                        <FiActivity className="mr-3" size={16} />
                                        JIT Requests
                                    </Link>

                                    {/* PO Specific Link for Products */}
                                    {isPO && (
                                        <Link to="/my-products" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all">
                                            <FiLayers className="mr-3" size={16} />
                                            My Product
                                        </Link>
                                    )}
                                </div>
                            )}

                            {/* Dynamic Sidebar Content (Chat History etc.) */}
                            <div className="flex-grow p-3">
                                {sidebarContent && (
                                    <>
                                        <div className="px-3 pb-2 pt-2">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Workspace</p>
                                        </div>
                                        {sidebarContent}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0a0a0a] min-w-[16rem]">
                            <button onClick={logout} className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md transition-colors">
                                <FiLogOut className="mr-3" size={16} />
                                Logout
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </>
    );
};

export default Sidebar;