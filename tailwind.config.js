/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          canvas: '#141312',
          surface: '#1C1B1A',
          elevated: '#262422',
          border: 'rgba(247, 246, 242, 0.08)',
        },
        terracotta: {
          DEFAULT: '#B85A1F', // WCAG AA compliant: 4.71:1 contrast against white text
          hover: '#A34E17',
          accent: '#D97736',
          dim: 'rgba(184, 90, 31, 0.15)',
        },
        sage: {
          DEFAULT: '#4E8752',
          hover: '#3F6F43',
          dim: 'rgba(78, 135, 82, 0.15)',
        },
        amber: {
          DEFAULT: '#D49B35',
          dim: 'rgba(212, 155, 53, 0.15)',
        },
        rust: {
          DEFAULT: '#BC4749',
          dim: 'rgba(188, 71, 73, 0.15)',
        },
        bone: {
          50: '#FAF9F6',
          100: '#F7F6F2',
          200: '#E5E3DC',
          300: '#BDBAB0',
          400: '#9E9B91',
          500: '#6E6B63',
          800: '#22201D',
          900: '#181716',
        },
        obsidian: {
          DEFAULT: '#141312',
          canvas: '#141312',
          surface: '#1C1B1A',
          elevated: '#262422',
          highlight: '#2F2D2A',
          border: 'rgba(247, 246, 242, 0.08)',
          borderSubtle: 'rgba(247, 246, 242, 0.04)',
        },
      },
      fontFamily: {
        sans: [
          'Roboto',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          '"Roboto Mono"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        'specular': 'inset 0 1px 0 rgba(255, 255, 255, 0.09)',
        'specular-subtle': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'executive': '0 20px 48px -12px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.06)',
        'dock': '0 -4px 24px -2px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.06)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'jewel-glow': 'glow 2.5s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
}
