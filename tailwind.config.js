/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#12161c',
          soft: '#3d4654',
          faint: '#6b7686',
        },
        paper: {
          DEFAULT: '#fbfaf7',
          raised: '#ffffff',
          sunk: '#f2efe9',
          edge: '#e3ded4',
        },
        // Reserved for the year in which worldwide income becomes taxable.
        alarm: '#a8323c',
        // Reserved for sheltered years.
        shelter: '#1f6f5c',
        accent: '#8a6a2f',
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
