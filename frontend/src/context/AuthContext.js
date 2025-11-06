import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
// [TASK 16] Removed googleLogin from import
import { loginUser, signupUser, getUserInfo } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const verifyAuth = useCallback(async () => {
        console.log('[AUTH_VERIFY] Checking for existing token...');
        const token = localStorage.getItem('token');
        if (token) {
            console.log('[AUTH_VERIFY] Token found. Fetching user info...');
            try {
                const userInfo = await getUserInfo();
                if (userInfo) {
                    console.log('[AUTH_VERIFY_SUCCESS] User info received:', userInfo);
                    setUser(userInfo); // This object now has { id, email, pictureUrl, role, productName }
                    setIsAuthenticated(true);
                } else {
                    console.warn('[AUTH_VERIFY_WARN] getUserInfo() returned empty. Token might be invalid.');
                    localStorage.removeItem('token');
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("[AUTH_VERIFY_FAIL] Auth verification failed (e.g., token expired):", error);
                localStorage.removeItem('token');
                setUser(null);
                setIsAuthenticated(false);
            }
        } else {
            console.log('[AUTH_VERIFY] No token found.');
            setIsAuthenticated(false);
            setUser(null);
        }
        setIsLoading(false);
        console.log(`[AUTH_VERIFY] Verification complete. Auth: ${isAuthenticated}, Loading: false`);
    }, []);

    useEffect(() => {
        verifyAuth();
    }, [verifyAuth]);

    const login = async (credentials) => {
        console.log('[AUTH_LOGIN] Attempting to log in...');
        const response = await loginUser(credentials);
        const { data } = response;
        if (data && data.token) {
            console.log('[AUTH_LOGIN] Login API successful. Token received.');
            localStorage.setItem('token', data.token);
            
            console.log('[AUTH_LOGIN] Fetching full user info...');
            try {
                const userInfo = await getUserInfo();
                if (userInfo) {
                    console.log('[AUTH_LOGIN] Full user info fetched:', userInfo);
                    setUser(userInfo); // This now includes role and productName
                    setIsAuthenticated(true);
                    console.log('[AUTH_LOGIN] Auth state updated with full user object.');
                } else {
                    throw new Error("Login succeeded but failed to fetch user info.");
                }
            } catch (fetchErr) {
                console.error('[AUTH_LOGIN_ERROR] Failed to fetch user info after login:', fetchErr);
                localStorage.removeItem('token');
                setUser(null);
                setIsAuthenticated(false);
                throw fetchErr; // Re-throw the error to the login page
            }
        }
        return response;
    };

    const register = async (email, password) => {
        console.log('[AUTH_REGISTER] Registering user...');
        const response = await signupUser({ email, password });
        return response;
    };

    // --- [TASK 16] REMOVED loginWithGoogle function ---

    const logout = () => {
        console.log('[AUTH_LOGOUT] Logging out. Clearing token and user.');
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
        // --- [TASK 16] REMOVED loginWithGoogle from context value ---
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
    return useContext(AuthContext);
};