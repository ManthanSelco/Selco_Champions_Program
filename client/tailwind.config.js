/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#16181D', soft: '#3A3F4A', mute: '#6B7280', faint: '#9AA1AD' },
        canvas: '#E9EDF2',
        selco: { DEFAULT: '#E3242B', dark: '#B5161C', soft: '#FDE8E8' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -8px rgba(16,24,40,.10)',
        lift: '0 2px 4px rgba(16,24,40,.06), 0 24px 48px -12px rgba(16,24,40,.22)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
