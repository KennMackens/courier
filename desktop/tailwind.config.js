/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary - Teal (Radix teal scale approximation)
        primary: {
          1: '#0d1514',
          2: '#111c1b',
          3: '#0d2d2a',
          4: '#023b37',
          5: '#084843',
          6: '#145750',
          7: '#1c6961',
          8: '#207e73',
          9: '#12a594',
          10: '#0eb39e',
          11: '#0bd8b6',
          12: '#adf0dd',
          DEFAULT: '#12a594',
        },
        // Accent - Pink (Radix pink scale approximation)
        accent: {
          1: '#1f1315',
          2: '#291a1d',
          3: '#3c1f26',
          4: '#4d222e',
          5: '#5c2636',
          6: '#6f2d40',
          7: '#8a364d',
          8: '#ad415e',
          9: '#e93d82',
          10: '#ed5091',
          11: '#f78ab5',
          12: '#fdd3e4',
          DEFAULT: '#e93d82',
        },
        // Neutral - Slate
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
