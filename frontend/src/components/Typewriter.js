import React, { useState, useEffect } from 'react';

const Typewriter = ({ messages, loop = false, typingDelay = 70, erasingDelay = 30, newSentenceDelay = 2000 }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleTyping = () => {
      const currentMessage = messages[messageIndex];
      const fullText = typeof currentMessage === 'string' ? currentMessage : currentMessage.text;

      if (isDeleting) {
        // Handle erasing
        setText((prev) => prev.substring(0, prev.length - 1));
      } else {
        // Handle typing
        setText((prev) => fullText.substring(0, prev.length + 1));
      }

      // Logic to switch between typing and erasing
      if (!isDeleting && text === fullText) {
        // Finished typing, pause then start erasing
        setTimeout(() => setIsDeleting(true), newSentenceDelay);
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        let nextIndex = messageIndex + 1;
        // Loop back to the beginning if loop is true
        if (nextIndex === messages.length && !loop) {
            return; // Stop if not looping
        }
        setMessageIndex(nextIndex % messages.length);
      }
    };

    const timeout = setTimeout(handleTyping, isDeleting ? erasingDelay : typingDelay);
    return () => clearTimeout(timeout);
  }, [text, isDeleting, messageIndex, messages, loop, typingDelay, erasingDelay, newSentenceDelay]);


  const currentMessageObject = messages[messageIndex];
  const style = typeof currentMessageObject === 'object' ? {
    color: currentMessageObject.color,
    fontStyle: currentMessageObject.style,
    fontWeight: currentMessageObject.weight,
    fontFamily: 'Inter, sans-serif' // Ensure Inter is used
  } : {};

  return (
    <span className="typing-effect" style={style}>
      {text}
      <span className="cursor-blink">|</span>
    </span>
  );
};

export default Typewriter;