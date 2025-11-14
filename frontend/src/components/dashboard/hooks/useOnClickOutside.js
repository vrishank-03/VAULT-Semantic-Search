// frontend/src/hooks/useOnClickOutside.js
// New File

import { useEffect } from 'react';

/**
 * A custom hook to detect clicks outside a specified element.
 * @param {React.RefObject} ref - The ref object of the element to track.
 * @param {Function} handler - The callback function to execute on an outside click.
 */
export default function useOnClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            handler(event);
        };

        // Add event listeners
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        // Cleanup event listeners on unmount
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]); // Re-run if ref or handler changes
}