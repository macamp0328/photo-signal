import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'main-text': colors.slate[900],
        'sub-text': colors.stone[700],
        'bonus-text': colors.zinc[700],
        'sub-background': colors.slate[300],
      },
      backgroundImage: {
        'gravel-texture': "url('/backgrounds/gravel.svg')",
      },
    },
  },
  plugins: [],
};
