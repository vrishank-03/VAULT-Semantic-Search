// frontend/src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
// --- [BLOCK 4] NEW IMPORT ---
import { SocketProvider } from './context/SocketContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Wrap the entire application with the Google OAuth Provider */}
    <GoogleOAuthProvider clientId="165897919722-k0ip25mbe87scrfq0odgughahdlf6rfs.apps.googleusercontent.com">
      {/* --- [BLOCK 4] WRAP WITH SOCKET PROVIDER --- */}
      <SocketProvider>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </SocketProvider>
      {/* --- [END BLOCK 4] --- */}
    </GoogleOAuthProvider>
  </React.StrictMode>
);

reportWebVitals();