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
      
      // [ELEGANCE_REFACTOR]
      // Override the default 'prose-sm' styles to add "breathing room"
      // This adds the intentional, elegant spacing you requested.
      typography: ({ theme }) => ({
        sm: { // This targets the 'prose-sm' class used in MessageBubble
          css: {
            // Add more vertical space between paragraphs
            p: {
              marginTop: theme('spacing.3'), // 0.75rem (12px)
              marginBottom: theme('spacing.3'),
              lineHeight: '1.6', // Increase line height for readability
            },
            // Add more space to lists
            'ul, ol': {
              marginTop: theme('spacing.3'),
              marginBottom: theme('spacing.3'),
            },
            // Add more space *above* headings
            'h1, h2, h3, h4, h5, h6': {
              marginTop: theme('spacing.5'), // 1.25rem (20px)
              marginBottom: theme('spacing.2'), // 0.5rem (8px)
            },
            // Ensure bolded text from the LLM is prominent
            strong: {
              fontWeight: '600',
              // Let the prose-invert handle the dark mode color automatically
            },
          },
        },
      }),
    },
  },

  plugins: [
    // Add the typography plugin
    require('@tailwindcss/typography'),
  ],
};