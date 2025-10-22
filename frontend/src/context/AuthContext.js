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
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const userInfo = await getUserInfo();
                if (userInfo) {
                    setUser(userInfo);
                    setIsAuthenticated(true);
                } else {
                    // This can happen if the token is invalid/expired
                    localStorage.removeItem('token');
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Auth verification failed:", error);
                localStorage.removeItem('token');
                setUser(null);
                setIsAuthenticated(false);
            }
        } else {
            setIsAuthenticated(false);
            setUser(null);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        verifyAuth();
    }, [verifyAuth]);

    const login = async (credentials) => {
        const response = await loginUser(credentials);
        const { data } = response;
        if (data && data.token) {
            localStorage.setItem('token', data.token);
            // 3. --- Set the user object on login ---
            setUser({ id: data.id, email: data.email, pictureUrl: data.pictureUrl });
            setIsAuthenticated(true);
        }
        return response;
    };

    const register = async (email, password) => {
        const response = await signupUser({ email, password });
        return response;
    };

    // --- MODIFICATIONS BELOW ---

    const loginWithGoogle = async (credentialResponse, pictureUrl) => { // <-- 1. MODIFIED SIGNATURE
        console.log("[LOG] AuthContext: loginWithGoogle triggered."); // <-- 2. ADDED LOG
        console.log("[LOG] AuthContext: Picture URL received:", pictureUrl); // <-- 3. ADDED LOG

        // 4. MODIFIED API CALL to pass the pictureUrl
        const response = await googleLogin(credentialResponse.credential, pictureUrl); 
        
        console.log("[LOG] AuthContext: API call to googleLogin service finished."); // <-- 5. ADDED LOG
        
        const { data } = response;
        if (data && data.token) {
            console.log("[LOG] AuthContext: Token received. Storing in localStorage."); // <-- 6. ADDED LOG
            localStorage.setItem('token', data.token);
            
            // 3. --- Set the user object on Google login ---
            console.log("[LOG] AuthContext: Calling getUserInfo() to refresh user state."); // <-- 7. ADDED LOG
            const userInfo = await getUserInfo(); // Fetch full user info including picture
            if (userInfo) {
                console.log("[LOG] AuthContext: User info received:", userInfo); // <-- 8. ADDED LOG
                setUser(userInfo);
            }
            setIsAuthenticated(true);
            console.log("[LOG] AuthContext: Authentication complete. User is set."); // <-- 9. ADDED LOG
        }
        return response;
    };

    // --- END OF MODIFICATIONS ---

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