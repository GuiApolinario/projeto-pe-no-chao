/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sol: { 50: '#FFF8E6', 100: '#FEEDBF', 200: '#FDDA80', 300: '#FBC640', 400: '#F7B518', 500: '#F2A900', 600: '#C98A00', 700: '#9A6900' },
        marca: { azul: '#1D4ED8', verde: '#65A30D', rosa: '#DB2777', laranja: '#EA7317', vermelho: '#DC2626', roxo: '#7C3AED', marrom: '#7C4A2D' },
      },
      fontFamily: {
        titulo: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
