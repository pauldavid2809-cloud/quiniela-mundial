import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#020817',
          800: '#0a0f1e',
          700: '#0f1629',
          600: '#151d35',
          500: '#1c2647',
        },
        gold: {
          400: '#FFE566',
          500: '#FFD700',
          600: '#E6C200',
        },
        crimson: {
          500: '#DC143C',
          600: '#B01030',
        },
        field: {
          dark: '#0d2318',
          mid: '#144a2e',
          light: '#1a5c38',
        },
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        body: ['var(--font-rajdhani)', 'sans-serif'],
      },
      backgroundImage: {
        'field-pattern': "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 80px)",
        'gold-gradient': 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
        'hero-gradient': 'radial-gradient(ellipse at top, #1c2647 0%, #020817 60%)',
      },
      animation: {
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'timer-shrink': 'timerShrink linear forwards',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(255,215,0,0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(255,215,0,0.7)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        timerShrink: {
          from: { width: '100%' },
          to: { width: '0%' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        glow: {
          from: { textShadow: '0 0 10px rgba(255,215,0,0.5)' },
          to: { textShadow: '0 0 20px rgba(255,215,0,1), 0 0 40px rgba(255,215,0,0.5)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
