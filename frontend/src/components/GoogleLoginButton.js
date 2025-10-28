import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
// 1. REMOVED useNavigate import
import { jwtDecode } from "jwt-decode"; 

const GoogleLoginButton = ({ setError }) => {
    const { loginWithGoogle } = useAuth();
    // 2. REMOVED const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        console.log("[LOG] GoogleLoginButton: handleGoogleSuccess triggered.");
        
        try {
            // Let's decode the JWT here to log the picture URL
            const decodedToken = jwtDecode(credentialResponse.credential);
            console.log("[LOG] GoogleLoginButton: Decoded JWT:", decodedToken);
            console.log("[LOG] GoogleLoginButton: User's picture URL:", decodedToken.picture);

            console.log("[LOG] GoogleLoginButton: Passing picture URL to AuthContext:", decodedToken.picture); // <-- 3. ADDED LOG
            await loginWithGoogle(credentialResponse, decodedToken.picture); // <-- 4. MODIFIED THIS LINE
            console.log("[LOG] GoogleLoginButton: loginWithGoogle call finished.");

            // 1. --- The navigate('/dashboard') call has been REMOVED ---
            // The application will now rely on a component that reacts to the
            // 'isAuthenticated' state change, which is the correct pattern.
            // A component like your LoginPage or a protected route handler will
            // now manage the redirection.
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            setError("Google Sign-In failed. Please try again.");
        }
    };

    const handleGoogleError = () => {
        setError("Google Sign-In process failed. Please try again.");
    };

    return (
        <div className="flex justify-center">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
            />
        </div>
    );
};

export default GoogleLoginButton;