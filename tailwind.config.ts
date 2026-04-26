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
        green: {
          primary: '#40916C',
          dark: '#1B4332',
          deeper: '#0A1A0F',
          accent: '#52B788',
          muted: '#2D6A4F',
          light: '#95D5B2',
          surface: '#162019',
          border: '#1E3020',
        },
        ryze: {
          bg: '#0A1A0F',
          surface: '#111A14',
          'surface-2': '#162019',
          border: '#1E3020',
          'border-light': '#2A4030',
          text: '#F8FBF9',
          'text-muted': '#8BA891',
          'text-dim': '#4A6B52',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(64, 145, 108, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(64, 145, 108, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'green-sm': '0 1px 3px rgba(64, 145, 108, 0.15)',
        'green-md': '0 4px 16px rgba(64, 145, 108, 0.2)',
        'green-lg': '0 8px 32px rgba(64, 145, 108, 0.25)',
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
