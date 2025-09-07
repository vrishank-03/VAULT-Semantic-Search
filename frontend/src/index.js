import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider> {/* Wrap AuthProvider with ThemeProvider */}
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);

reportWebVitals();