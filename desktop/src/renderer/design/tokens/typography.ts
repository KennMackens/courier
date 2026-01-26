/**
 * Typography Design Tokens
 *
 * Font system based on Geist (Vercel's typeface) with system font fallbacks.
 * Optimized for developer-focused, high-readability interfaces.
 */

export const fontFamily = {
  // Primary sans-serif: Geist with system fallbacks
  sans: [
    'Geist',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Oxygen',
    'Ubuntu',
    'Cantarell',
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    'system-ui',
    'sans-serif',
  ],

  // Monospace: Geist Mono with system fallbacks
  mono: [
    'Geist Mono',
    'SF Mono',
    'Monaco',
    'Inconsolata',
    'Fira Mono',
    'Droid Sans Mono',
    'Source Code Pro',
    'Consolas',
    'Liberation Mono',
    'Menlo',
    'Courier New',
    'monospace',
  ],
} as const;

// Font size scale (rem-based for accessibility)
export const fontSize = {
  xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
  sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
  base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
  lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
  xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
  '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
} as const;

// Font weights
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Line heights
export const lineHeight = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const;

// Letter spacing
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// Text styles (composites for common use cases)
export const textStyles = {
  // Headings
  h1: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '2.25rem',
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '1.875rem',
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '1.5rem',
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  h4: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '1.25rem',
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },

  // Body text
  body: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '1rem',
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySmall: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '0.875rem',
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },

  // UI elements
  label: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '0.875rem',
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.none,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: fontFamily.sans.join(', '),
    fontSize: '0.75rem',
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },

  // Code
  code: {
    fontFamily: fontFamily.mono.join(', '),
    fontSize: '0.875rem',
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
} as const;

export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
} as const;
