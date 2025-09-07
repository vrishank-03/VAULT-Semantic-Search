import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';
import './Toast.css';

const icons = {
  success: <FiCheckCircle />,
  error: <FiAlertTriangle />,
  info: <FiInfo />,
};

function Toast({ message, type, onClose, duration = 10000 }) {
  // --- ADDED LOG ---
  console.log(`%c[Toast] Component Rendered. Message: "${message}", Type: ${type}`, 'color: #2ECC71');
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // --- ADDED LOG ---
    console.log(`%c[Toast] useEffect triggered. Setting timer to disappear in ${duration}ms.`, 'color: #2ECC71');

    const timer = setTimeout(() => {
      // --- ADDED LOG ---
      console.log('%c[Toast] Timer FINISHED. Starting exit animation.', 'color: #E74C3C');
      setExiting(true);
      setTimeout(onClose, 400); // Wait for exit animation
    }, duration);

    // This is a cleanup function. It runs if the component is removed from the screen early.
    return () => {
      // --- ADDED LOG ---
      console.log('%c[Toast] Cleanup function run. This means the component was unmounted. Clearing timer.', 'color: #F39C12');
      clearTimeout(timer);
    };
  }, [onClose, duration]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 400);
  };

  const icon = icons[type] || <FiInfo />;

  return (
    <div className={`toast ${type} ${exiting ? 'exiting' : ''}`}>
      <div className="toast-icon">{icon}</div>
      <p className="toast-message">{message}</p>
      <button onClick={handleClose} className="toast-close-button">
        <FiX />
      </button>
      <div
        className="toast-progress"
        style={{ animation: `progress ${duration / 1000}s linear forwards` }}
      />
    </div>
  );
}

export default Toast;