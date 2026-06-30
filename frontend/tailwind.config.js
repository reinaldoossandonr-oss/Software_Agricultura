/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1AABF0',
          50:  '#E8F7FD',
          100: '#C5ECFB',
          200: '#8DD8F7',
          300: '#55C4F3',
          400: '#2BB6F1',
          500: '#1AABF0',
          600: '#0E87BF',
          700: '#09668F',
          800: '#06475F',
          900: '#03273A',
        },
        sidebar: '#0F172A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
