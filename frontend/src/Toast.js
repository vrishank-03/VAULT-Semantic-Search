import React, { useEffect } from 'react';
import './Toast.css';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    // Automatically close the toast after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    // Cleanup timer if the component is unmounted
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      <p>{message}</p>
      <button onClick={onClose} className="toast-close-button">×</button>
    </div>
  );
}

export default Toast;