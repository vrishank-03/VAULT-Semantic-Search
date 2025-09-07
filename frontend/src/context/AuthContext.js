import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
// 1. --- Import signupUser alongside loginUser ---
import { loginUser, signupUser } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const verifyAuth = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // In a real app, you'd verify the token with an API call here.
                // For now, we'll assume a token means the user is authenticated.
                setIsAuthenticated(true);
            } catch (error) {
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
        const response = await loginUser(credentials);
        if (response.data && response.data.token) {
            localStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
        }
        return response;
    };

    // 2. --- ADD THE MISSING REGISTER FUNCTION ---
    // This function takes the email and password, calls the API service,
    // and returns the response. The SignupPage will handle what to do next.
    const register = async (email, password) => {
        // We pass the credentials as an object, which signupUser expects.
        const response = await signupUser({ email, password });
        return response;
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
        // 3. --- PROVIDE THE NEW FUNCTION TO THE APP ---
        // Now, when any component calls useAuth(), it will receive the register function.
        register,
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
