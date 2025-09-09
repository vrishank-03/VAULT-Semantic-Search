import React from 'react';

// This new component accepts a "message" prop.
// We give it a default value of "Success!" in case one isn't provided.
const GenericSuccessAnimation = ({ message = "Success!" }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="success-animation">
        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
      <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
        {/* The text now comes from the message prop */}
        {message}
      </p>
    </div>
  );
};

export default GenericSuccessAnimation;