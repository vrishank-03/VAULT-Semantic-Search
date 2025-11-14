// frontend/src/App.js
// Refactored

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChatRoomPage from './pages/ChatRoomPage';

// Components
import PrivateRoute from './components/PrivateRoute';
// --- [NEW] Import the new layout ---
import AppLayout from './AppLayout'; 
// --- [REMOVED] Navbar is no longer used in this core routing ---
// import Navbar from './components/Navbar'; 


function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <Router>
                    <AppContent />
                </Router>
            </ThemeProvider>
        </AuthProvider>
    );
}

const AppContent = () => {
    const { isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-medium text-gray-700 dark:text-gray-200">Loading VAULT...</div>
            </div>
        );
    }

    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Private Routes */}
            <Route element={<PrivateRoute />}>
                {/* --- [MODIFIED] All auth'd routes now render inside AppLayout --- */}
                <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/chat/:roomId" element={<ChatRoomPage />} />
                </Route>
            </Route>

            {/* Root Path Handler */}
            <Route
                path="/"
                element={
                    isAuthenticated ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            />

            {/* Fallback for any unmatched routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;