/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  // Enable dark mode using the 'class' strategy
  darkMode: 'class',

  // Tell Tailwind where to look for class names
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {
      // Add custom fonts
      fontFamily: {
        // Override the default sans font to Inter
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        // Create an additional class-based font utility: font-inter
        inter: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },

  plugins: [],
};
