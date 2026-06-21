/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: '#312e81'
        }
      },
      animation: {
        pulseRing: 'pulseRing 1.5s ease-in-out infinite'
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.7' }
        }
      }
    }
  },
  plugins: []
}
