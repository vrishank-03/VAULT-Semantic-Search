import React, { useState, useEffect, useMemo } from 'react';

const Typewriter = ({ initialSentence }) => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  // Memoize the list of phrases and colors to avoid re-creating them on every render.
  const phrases = useMemo(() => [
    initialSentence,
    "नमस्ते", // Hindi
    "Bienvenue", // French
    "أهلاً و سهلاً", // Arabic
    "Vítejte", // Czech
    "Добро пожаловать", // Russian
    "Hoşgeldiniz", // Turkish
    "Welcome" // English
  ], [initialSentence]);

  const colors = useMemo(() => [
    'inherit', // Default color for the initial sentence
    '#FF9933', // Saffron for Hindi
    '#0055A4', // Blue for French
    '#008000', // Green for Arabic
    '#D7141A', // Red for Czech
    '#D52B1E', // Red for Russian
    '#E30A17', // Red for Turkish
    '#34D399'  // Green for English
  ], []);

  useEffect(() => {
    let ticker;

    const handleTyping = () => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];
      const currentColor = colors[i];
      
      document.documentElement.style.setProperty('--typewriter-color', currentColor);

      setText(
        isDeleting
          ? fullText.substring(0, text.length - 1)
          : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 40 : 150);

      if (!isDeleting && text === fullText) {
        ticker = setTimeout(() => setIsDeleting(true), 2000);
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
      className="text-3xl md:text-4xl text-center typewriter-font h-16 md:h-20 flex items-center justify-center"
    >
      <span className="typing-effect">{text}</span>
      <span className="cursor-blink">|</span>
    </h1>
  );
};

export default Typewriter;