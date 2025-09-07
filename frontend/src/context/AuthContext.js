import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api, { loginUser } from '../services/api'; // Ensure your api services are correctly imported

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Start with loading state true

    // This function checks for a token on initial app load
    const verifyAuth = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // You can optionally add an API call here to verify the token 
                // and get fresh user data, e.g., api.get('/auth/me')
                setIsAuthenticated(true);
            } catch (error) {
                // If token is invalid, remove it
                localStorage.removeItem('token');
                setIsAuthenticated(false);
            }
        } else {
            setIsAuthenticated(false);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        verifyAuth();
    }, [verifyAuth]);

    const login = async (credentials) => {
        // This function will be called from LoginPage
        const response = await loginUser(credentials); // Call the original API function
        if (response.data && response.data.token) {
            localStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
            // You can also set user data here if the response includes it
            // setUser(response.data.user); 
        }
        return response; // Return the response for any further handling
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
    return useContext(AuthContext);
};
