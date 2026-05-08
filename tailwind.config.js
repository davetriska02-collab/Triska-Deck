/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        triska: {
          panel: '#0f172a',
          accent: '#38bdf8',
          safe: '#22c55e',
          confirm: '#f59e0b',
          live: '#ef4444',
        },
      },
      boxShadow: {
        live: '0 0 0 2px rgba(239,68,68,0.9), 0 0 18px rgba(239,68,68,0.6)',
      },
    },
  },
  plugins: [],
};
