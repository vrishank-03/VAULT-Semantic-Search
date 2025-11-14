// frontend/src/components/Typewriter.js
// Updated File

import React, { useState, useEffect, useMemo } from 'react';

const Typewriter = ({ initialSentence }) => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  // --- [MODIFIED] Slogans are now professional and benefit-driven ---
  const phrases = useMemo(() => [
    initialSentence,
    "it's simple with vault.",
  ], [initialSentence]);

  // --- [MODIFIED] Colors are now a clean, modern tech palette ---
  const colors = useMemo(() => [
    'inherit', // Default color for the initial sentence
    '#3B82F6', // Brand Blue (blue-500)
    '#10B981', // Success Green (emerald-500)
    '#6366F1', // AI Indigo (indigo-500)
    '#3B82F6', // Brand Blue
    '#10B981', // Success Green
    '#6366F1'  // AI Indigo
  ], []);

  useEffect(() => {
    let ticker;

    const handleTyping = () => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];
      const currentColor = colors[i];
      
      // Set CSS variable for color
      document.documentElement.style.setProperty('--typewriter-color', currentColor);

      setText(
        isDeleting
          ? fullText.substring(0, text.length - 1)
          : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 40 : 150);

      if (!isDeleting && text === fullText) {
        ticker = setTimeout(() => setIsDeleting(true), 2000); // Pause on full text
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    ticker = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(ticker);
  }, [text, isDeleting, loopNum, phrases, colors, typingSpeed]);

  return (
    <h1 
      // --- [MODIFIED] Using new font-inter and adjusted sizing/weight ---
      className="text-3xl md:text-4xl text-center font-inter font-semibold h-16 md:h-20 flex items-center justify-center"
    >
      <span className="typing-effect">{text}</span>
      <span className="cursor-blink">|</span>
    </h1>
  );
};

export default Typewriter;