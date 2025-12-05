// frontend/src/App.js
// Refactored

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
// [FIX] AuthProvider is no longer needed here
import { useAuth } from './context/AuthContext';
// [FIX] ThemeProvider is no longer needed here

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';
import ResetPasswordPage from './pages/ResetPasswordPage';
// [FIX] Use the new ChatRoomPage index file
import ChatRoomPage from './pages/ChatRoomPage'; 

// Components
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './AppLayout'; 


function App() {
    return (
        /* [FIX] Removed redundant AuthProvider and ThemeProvider.
          They are now correctly placed in index.js.
        */
        <Router>
            <AppContent />
        </Router>
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
                <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    {/* [FIX] Ensure this path points to your new component index */}
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