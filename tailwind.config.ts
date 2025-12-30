import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0a0b10',
          800: '#10131c',
          700: '#151a26',
          600: '#20263a'
        },
        skyline: {
          500: '#5bd7ff',
          600: '#2cb4ff'
        },
        coral: {
          400: '#ff8d6b',
          500: '#ff6a3d'
        }
      },
      boxShadow: {
        glow: '0 0 40px rgba(91, 215, 255, 0.35)',
        card: '0 24px 80px rgba(10, 11, 16, 0.45)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
