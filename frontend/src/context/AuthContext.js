import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
// 1. --- Import the new googleLogin function from your API service ---
import { loginUser, signupUser, googleLogin } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const verifyAuth = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsAuthenticated(true);
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

    const register = async (email, password) => {
        const response = await signupUser({ email, password });
        return response;
    };

    // 2. --- ADD THE MISSING loginWithGoogle FUNCTION ---
    // This function receives the credential response from the Google button,
    // sends it to your backend, and handles setting the auth state.
    const loginWithGoogle = async (credentialResponse) => {
        // The 'credential' is the ID token from Google
        const response = await googleLogin(credentialResponse.credential);
        if (response.data && response.data.token) {
            localStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
        }
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
        register,
        // 3. --- PROVIDE THE NEW FUNCTION TO THE APP ---
        // Now, when the GoogleLoginButton calls useAuth(), it will receive this function.
        loginWithGoogle, 
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