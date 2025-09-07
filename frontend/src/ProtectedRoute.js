import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
    const { isAuthenticated, isLoading } = useAuth();

    // While the context is checking for a token, don't render anything
    if (isLoading) {
        return null; // Or a loading spinner
    }

    // If loading is finished and user is not authenticated, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render the nested component (e.g., Dashboard)
    return <Outlet />;
};

export default PrivateRoute;
