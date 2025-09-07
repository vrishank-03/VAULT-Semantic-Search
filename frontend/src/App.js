import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext'; // Make sure ThemeProvider is included

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';

// Components
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';

// This layout component can be used for OTHER authenticated pages
// that might need a standard top navigation bar in the future.
const AppLayout = () => (
  <>
    <Navbar />
    <main>
      <Outlet />
    </main>
  </>
);

function App() {
  return (
    // Both Auth and Theme providers are necessary for the whole app to function
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

// This component contains the core routing logic
const AppContent = () => {
  const { isLoading, isAuthenticated } = useAuth();

  // Display a loading screen while the authentication status is being checked
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

      {/* Private Routes */}
      <Route element={<PrivateRoute />}>
        {/* The Dashboard now has its OWN layout and is not wrapped by AppLayout */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* You can still use AppLayout for other future pages like this: */}
        {/*
        <Route element={<AppLayout />}>
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        */}
      </Route>

      {/* Root Path Handler */}
      {/* This redirects users to the correct page based on their login status */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
      />

      {/* Fallback for any unmatched routes */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}

export default App;
