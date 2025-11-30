import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { loginUser, signupUser, getUserInfo } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const verifyAuth = useCallback(async () => {
        console.log('[AUTH_FLOW] verifyAuth() initiated.');
        
        // 1. Check for token existence
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.log('[AUTH_FLOW] No token found in localStorage. Stopping.');
            setIsAuthenticated(false);
            setUser(null);
            setIsLoading(false);
            return;
        }

        // 2. Token exists, try to validate with backend
        console.log('[AUTH_FLOW] Token found. Verifying with backend...');
        try {
            // This call will trigger api.js. 
            // If it returns 401, api.js throws error, we catch it here.
            const userInfo = await getUserInfo();
            
            if (userInfo) {
                console.log('[AUTH_FLOW] Verification Success. User:', userInfo.email);
                setUser(userInfo);
                setIsAuthenticated(true);
            } else {
                throw new Error('Empty user info returned');
            }
        } catch (error) {
            // [CIRCUIT_BREAKER]
            // If verification fails (401, 403, Network), we MUST assume invalid token
            // and clear it to prevent infinite loops.
            console.error("[AUTH_FLOW] Verification Failed:", error.message);
            
            console.log('[AUTH_FLOW] Clearing invalid token to prevent retry loop.');
            localStorage.removeItem('token');
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
            console.log('[AUTH_FLOW] verifyAuth() complete.');
        }
    }, []);

    // Run verifyAuth ONLY once on mount
    useEffect(() => {
        verifyAuth();
    }, [verifyAuth]);

    const login = async (credentials) => {
        console.log('[AUTH_FLOW] Login initiated...');
        const response = await loginUser(credentials);
        const { data } = response;
        
        if (data && data.token) {
            console.log('[AUTH_FLOW] Login successful. Token received.');
            localStorage.setItem('token', data.token);
            
            // Immediately fetch user info to populate context
            try {
                const userInfo = await getUserInfo();
                setUser(userInfo);
                setIsAuthenticated(true);
            } catch (fetchErr) {
                console.error('[AUTH_FLOW] Login succeeded but fetching profile failed:', fetchErr);
                localStorage.removeItem('token');
                throw fetchErr;
            }
        }
        return response;
    };

    const register = async (email, password) => {
        console.log('[AUTH_FLOW] Registration initiated...');
        return await signupUser({ email, password });
    };

    const logout = () => {
        console.log('[AUTH_FLOW] Manual Logout.');
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
        window.location.replace('/login'); // Clean redirect
    };

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        register,
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};