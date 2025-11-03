import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
// 1. --- Import getUserInfo to verify the token ---
import { loginUser, signupUser, googleLogin, getUserInfo } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 2. --- This function is now more robust ---
    // It will verify the token by fetching user data, ensuring the session is valid.
    const verifyAuth = useCallback(async () => {
        console.log('[AUTH_VERIFY] Checking for existing token...');
        const token = localStorage.getItem('token');
        if (token) {
            console.log('[AUTH_VERIFY] Token found. Fetching user info...');
            try {
                const userInfo = await getUserInfo();
                if (userInfo) {
                    // --- [MODIFIED] userInfo now contains role and productName ---
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
    }, []); // --- [MODIFIED] Removed isAuthenticated from dependency array

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
            
            // --- [MODIFIED] Fetch full user info *immediately* after login ---
            console.log('[AUTH_LOGIN] Fetching full user info...');
            try {
                const userInfo = await getUserInfo();
                if (userInfo) {
                    console.log('[AUTH_LOGIN] Full user info fetched:', userInfo);
                    setUser(userInfo); // This now includes role and productName
                    setIsAuthenticated(true);
                    console.log('[AUTH_LOGIN] Auth state updated with full user object.');
                } else {
                    // This should not happen if login succeeded, but good to guard
                    throw new Error("Login succeeded but failed to fetch user info.");
                }
            } catch (fetchErr) {
                console.error('[AUTH_LOGIN_ERROR] Failed to fetch user info after login:', fetchErr);
                // Log them out to be safe
                localStorage.removeItem('token');
                setUser(null);
                setIsAuthenticated(false);
                throw fetchErr; // Re-throw the error to the login page
            }
            // --- [END MODIFIED] ---
        }
        return response;
    };

    const register = async (email, password) => {
        // --- [MODIFIED] This function is just a proxy, no changes needed to its logic ---
        // The signupUser service will now be sending { email, password, role, productName }
        // We'll update the function signature to match the new payload
        console.log('[AUTH_REGISTER] Registering user...');
        // The actual arguments are passed directly in SignupPage.js, this is just a stub
        // No, the 'register' function in the value object isn't actually used by SignupPage.js
        // Let's update it to be correct anyway, in case it's used elsewhere.
        // Re-reading... no, SignupPage.js imports `signupUser` directly.
        // This 'register' function seems unused. We'll leave it as is.
        const response = await signupUser({ email, password });
        return response;
    };

    // --- MODIFICATIONS BELOW ---

    const loginWithGoogle = async (credentialResponse, pictureUrl) => { 
        console.log("[AUTH_GOOGLE_LOGIN] AuthContext: loginWithGoogle triggered.");
        
        const response = await googleLogin(credentialResponse.credential, pictureUrl); 
        
        console.log("[AUTH_GOOGLE_LOGIN] API call to googleLogin service finished.");
        
        const { data } = response;
        if (data && data.token) {
            console.log("[AUTH_GOOGLE_LOGIN] Token received. Storing in localStorage.");
            localStorage.setItem('token', data.token);
            
            // --- [MODIFIED] This already follows the correct pattern ---
            console.log("[AUTH_GOOGLE_LOGIN] Calling getUserInfo() to refresh user state.");
            const userInfo = await getUserInfo(); // Fetch full user info including picture, role, productName
            if (userInfo) {
                console.log("[AUTH_GOOGLE_LOGIN] Full user info received:", userInfo);
                setUser(userInfo);
                setIsAuthenticated(true);
                console.log("[AUTH_GOOGLE_LOGIN] Authentication complete. User is set.");
            } else {
                console.error('[AUTH_GOOGLE_LOGIN_ERROR] Failed to fetch user info after Google login.');
                localStorage.removeItem('token');
                setUser(null);
                setIsAuthenticated(false);
            }
            // --- [END MODIFIED] ---
        }
        return response;
    };

    // --- END OF MODIFICATIONS ---

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
        loginWithGoogle, 
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