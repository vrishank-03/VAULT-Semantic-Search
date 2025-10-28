import React from 'react';
import { motion } from 'framer-motion';

const ThinkingAnimation = () => {
  // This variant will be for the container, to orchestrate the animation of the dots
  const containerVariants = {
    animate: {
      transition: {
        staggerChildren: 0.15, // The delay between each dot's animation starting
      },
    },
  };

  // This variant defines the animation for each individual dot
  const dotVariants = {
    animate: {
      y: [0, -10, 0], // The dot will move up 10 pixels and then back down
      transition: {
        duration: 0.7,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="flex items-center gap-2 p-4" // Added padding for spacing
    >
      <motion.div variants={dotVariants} className="w-2.5 h-2.5 bg-gray-400 dark:bg-gray-500 rounded-full" />
      <motion.div variants={dotVariants} className="w-2.5 h-2.5 bg-gray-400 dark:bg-gray-500 rounded-full" />
      <motion.div variants={dotVariants} className="w-2.5 h-2.5 bg-gray-400 dark:bg-gray-500 rounded-full" />
    </motion.div>
  );
};

export default ThinkingAnimation;