/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary - Jade (Radix jade scale via CSS variables)
        primary: {
          1: 'var(--jade-1)',
          2: 'var(--jade-2)',
          3: 'var(--jade-3)',
          4: 'var(--jade-4)',
          5: 'var(--jade-5)',
          6: 'var(--jade-6)',
          7: 'var(--jade-7)',
          8: 'var(--jade-8)',
          9: 'var(--jade-9)',
          10: 'var(--jade-10)',
          11: 'var(--jade-11)',
          12: 'var(--jade-12)',
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        // Accent - Pink (Radix pink scale via CSS variables)
        accent: {
          1: 'var(--pink-1)',
          2: 'var(--pink-2)',
          3: 'var(--pink-3)',
          4: 'var(--pink-4)',
          5: 'var(--pink-5)',
          6: 'var(--pink-6)',
          7: 'var(--pink-7)',
          8: 'var(--pink-8)',
          9: 'var(--pink-9)',
          10: 'var(--pink-10)',
          11: 'var(--pink-11)',
          12: 'var(--pink-12)',
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        // Neutral - Slate (Radix slate scale via CSS variables)
        slate: {
          1: 'var(--slate-1)',
          2: 'var(--slate-2)',
          3: 'var(--slate-3)',
          4: 'var(--slate-4)',
          5: 'var(--slate-5)',
          6: 'var(--slate-6)',
          7: 'var(--slate-7)',
          8: 'var(--slate-8)',
          9: 'var(--slate-9)',
          10: 'var(--slate-10)',
          11: 'var(--slate-11)',
          12: 'var(--slate-12)',
        },
        // Destructive - Red (Radix red scale via CSS variables)
        red: {
          1: 'var(--red-1)',
          2: 'var(--red-2)',
          3: 'var(--red-3)',
          4: 'var(--red-4)',
          5: 'var(--red-5)',
          6: 'var(--red-6)',
          7: 'var(--red-7)',
          8: 'var(--red-8)',
          9: 'var(--red-9)',
          10: 'var(--red-10)',
          11: 'var(--red-11)',
          12: 'var(--red-12)',
        },
        // Semantic colors (for shadcn/ui compatibility)
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          'Geist Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'Geist Mono Variable',
          'SF Mono',
          'Monaco',
          'Inconsolata',
          'Consolas',
          'Liberation Mono',
          'Menlo',
          'monospace',
        ],
      },
      // Minimal box shadows (Linear-inspired)
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'ring': '0 0 0 2px var(--jade-7)',
        'ring-offset': '0 0 0 2px var(--background), 0 0 0 4px var(--jade-7)',
      },
      // Animation for subtle interactions
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
        'slide-in-from-top': 'slide-in-from-top 200ms ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 200ms ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
