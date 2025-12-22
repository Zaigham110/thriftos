/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}"
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          soft: '#DBEAFE',
        },
        // Status colors (muted, ERP-safe)
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        info: '#0284C7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
