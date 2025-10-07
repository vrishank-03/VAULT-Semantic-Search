import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GoogleLoginButton = ({ setError }) => {
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await loginWithGoogle(credentialResponse);
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