import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GoogleLoginButton = ({ setError }) => {
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    // This function is called on a successful Google Sign-In.
    // The 'credentialResponse' object contains the ID token from Google.
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            // We call the 'loginWithGoogle' function from our AuthContext,
            // which will send the token to our backend.
            await loginWithGoogle(credentialResponse);
            // On success, navigate the user to their dashboard.
            navigate('/dashboard');
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            setError("Google Sign-In failed. Please try again.");
        }
    };

    // This function is called if Google's login process fails.
    const handleGoogleError = () => {
        setError("Google Sign-In process failed. Please try again.");
    };

    return (
        <div className="flex justify-center">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                // You can adjust the width or other props here if needed
            />
        </div>
    );
};

export default GoogleLoginButton;