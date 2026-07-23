// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E', // teal - identitas utama app kesehatan
          light: '#14B8A6',
          dark: '#0B5A54',
        },
        danger: '#DC2626',
        warning: '#D97706',
        success: '#059669',
      },
      screens: {
        // breakpoint tambahan agar web dashboard bisa multi-kolom lebar
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
      },
    },
  },
  plugins: [],
};
