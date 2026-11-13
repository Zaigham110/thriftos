/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // ThriftOS plum.
        brand: { 50: '#f7f2f6', 100: '#ece0e9', 200: '#d9c2d3', 300: '#c2a0b9', 400: '#a67c9a', 500: '#8a5f7f', 600: '#714b67', 700: '#5c3c54', 800: '#472e41', 900: '#33212f', 950: '#231620' },
        // The counter's own surface: a warm paper grey that white tiles sit on.
        paper: '#f5f3f0',
        // Money in: the one colour for "take the payment".
        pay: { 500: '#12a15f', 600: '#0b8a4f', 700: '#08733f' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { tile: '0 1px 2px rgba(35,22,32,.06), 0 1px 1px rgba(35,22,32,.04)', lift: '0 12px 32px rgba(35,22,32,.18)' },
    },
  },
  plugins: [],
};
