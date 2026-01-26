/**
 * Color Design Tokens
 *
 * Based on Radix UI color system with P3 wide gamut support.
 * - Primary: Jade (green-teal)
 * - Accent: Pink
 * - Neutral: Slate
 *
 * Color scale meanings (Radix convention):
 * 1-2: App/subtle backgrounds
 * 3-5: Component backgrounds (hover, active)
 * 6: Subtle borders, separators
 * 7: UI element borders, focus rings
 * 8: Hovered borders
 * 9: Solid backgrounds (buttons)
 * 10: Hovered solid backgrounds
 * 11: Low-contrast text
 * 12: High-contrast text
 */

// Jade - Primary brand color (Light mode)
export const jade = {
  1: '#f0fdf6',
  2: '#e6fbef',
  3: '#cbf5dd',
  4: '#a8ebc8',
  5: '#7ddcae',
  6: '#4fca94',
  7: '#33b982',
  8: '#26a272',
  9: '#29a371',  // Default - solid backgrounds
  10: '#218c62',
  11: '#1a6f4e',
  12: '#0d3d2a',
} as const;

// Jade Dark - Primary brand color (Dark mode)
export const jadeDark = {
  1: '#0c1a14',
  2: '#0f231a',
  3: '#122d22',
  4: '#14382b',
  5: '#164333',
  6: '#1a503e',
  7: '#1f6149',
  8: '#277556',
  9: '#29a371',  // Default - solid backgrounds
  10: '#33b882',
  11: '#4fca94',
  12: '#c1f1d5',
} as const;

// Pink - Accent color (Light mode)
export const pink = {
  1: '#fef4f8',
  2: '#fee7f0',
  3: '#fdd3e4',
  4: '#fcbbd5',
  5: '#f99fc3',
  6: '#f381af',
  7: '#eb639a',
  8: '#e14584',
  9: '#d6336c',  // Default - solid backgrounds
  10: '#c72a60',
  11: '#a62152',
  12: '#5c132e',
} as const;

// Pink Dark - Accent color (Dark mode)
export const pinkDark = {
  1: '#1f1318',
  2: '#2a1620',
  3: '#3b1a2b',
  4: '#4c1e37',
  5: '#5e2243',
  6: '#732751',
  7: '#8f2e63',
  8: '#b33577',
  9: '#d6336c',  // Default - solid backgrounds
  10: '#e24580',
  11: '#f381af',
  12: '#fdd3e4',
} as const;

// Slate - Neutral color (Light mode)
export const slate = {
  1: '#fcfcfd',
  2: '#f9f9fb',
  3: '#f0f0f3',
  4: '#e8e8ec',
  5: '#e0e1e6',
  6: '#d9d9e0',
  7: '#cdced6',
  8: '#b9bbc6',
  9: '#8b8d98',
  10: '#80828d',
  11: '#60646c',
  12: '#1c2024',
} as const;

// Slate Dark - Neutral color (Dark mode)
export const slateDark = {
  1: '#111113',
  2: '#18191b',
  3: '#212225',
  4: '#272a2d',
  5: '#2e3135',
  6: '#363a3f',
  7: '#43484e',
  8: '#5a6169',
  9: '#696e77',
  10: '#777b84',
  11: '#b0b4ba',
  12: '#edeef0',
} as const;

// Red - Destructive actions (Light mode)
export const red = {
  1: '#fffcfc',
  2: '#fff7f7',
  3: '#feebec',
  4: '#ffdce0',
  5: '#ffced4',
  6: '#f9bec6',
  7: '#f0a9b4',
  8: '#e5909d',
  9: '#e5484d',
  10: '#dc3e42',
  11: '#ce2c31',
  12: '#641723',
} as const;

// Red Dark - Destructive actions (Dark mode)
export const redDark = {
  1: '#191111',
  2: '#201314',
  3: '#3b1219',
  4: '#500f1c',
  5: '#611623',
  6: '#72232d',
  7: '#8c333a',
  8: '#b54548',
  9: '#e5484d',
  10: '#ec5d5e',
  11: '#ff9592',
  12: '#ffd1d9',
} as const;

// Semantic color mappings
export const colors = {
  // Primary - Jade for main actions, links, interactive elements
  primary: {
    bg: 'var(--jade-3)',       // Subtle background
    bgHover: 'var(--jade-4)',  // Hover background
    bgActive: 'var(--jade-5)', // Active/pressed background
    border: 'var(--jade-7)',   // Border color
    borderHover: 'var(--jade-8)', // Hovered border
    solid: 'var(--jade-9)',    // Solid button background
    solidHover: 'var(--jade-10)', // Hovered solid button
    text: 'var(--jade-11)',    // Low-contrast text (links)
    textContrast: 'var(--jade-12)', // High-contrast text
  },

  // Accent - Pink for highlights, badges, notifications
  accent: {
    bg: 'var(--pink-3)',
    bgHover: 'var(--pink-4)',
    bgActive: 'var(--pink-5)',
    border: 'var(--pink-7)',
    borderHover: 'var(--pink-8)',
    solid: 'var(--pink-9)',
    solidHover: 'var(--pink-10)',
    text: 'var(--pink-11)',
    textContrast: 'var(--pink-12)',
  },

  // Neutral - Slate for backgrounds, borders, text
  neutral: {
    bg: 'var(--slate-1)',           // App background
    bgSubtle: 'var(--slate-2)',     // Subtle background
    bgElement: 'var(--slate-3)',    // UI element background
    bgElementHover: 'var(--slate-4)', // Hovered element
    bgElementActive: 'var(--slate-5)', // Active element
    border: 'var(--slate-6)',       // Hairline borders
    borderElement: 'var(--slate-7)', // Element borders
    borderElementHover: 'var(--slate-8)', // Hovered borders
    textMuted: 'var(--slate-9)',    // Placeholder, disabled
    textSubtle: 'var(--slate-10)',  // Secondary text
    text: 'var(--slate-11)',        // Primary text
    textContrast: 'var(--slate-12)', // High-contrast text
  },

  // Destructive - Red for errors, delete actions
  destructive: {
    bg: 'var(--red-3)',
    bgHover: 'var(--red-4)',
    bgActive: 'var(--red-5)',
    border: 'var(--red-7)',
    solid: 'var(--red-9)',
    solidHover: 'var(--red-10)',
    text: 'var(--red-11)',
    textContrast: 'var(--red-12)',
  },
} as const;

export type ColorScale = typeof jade;
export type SemanticColors = typeof colors;
