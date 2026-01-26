/**
 * Spacing Design Tokens
 *
 * Based on 4px base unit (0.25rem) for consistent spacing.
 * Uses a geometric scale for harmonious relationships.
 */

// Base spacing scale (in rem, 1rem = 16px)
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',       // 144px
  40: '10rem',      // 160px
  44: '11rem',      // 176px
  48: '12rem',      // 192px
  52: '13rem',      // 208px
  56: '14rem',      // 224px
  60: '15rem',      // 240px
  64: '16rem',      // 256px
  72: '18rem',      // 288px
  80: '20rem',      // 320px
  96: '24rem',      // 384px
} as const;

// Border radius scale
export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px - subtle rounding
  md: '0.375rem',   // 6px - default
  lg: '0.5rem',     // 8px - buttons, cards
  xl: '0.75rem',    // 12px - larger cards
  '2xl': '1rem',    // 16px - modals
  '3xl': '1.5rem',  // 24px - large containers
  full: '9999px',   // Fully rounded (pills, avatars)
} as const;

// Border width scale
export const borderWidth = {
  0: '0',
  DEFAULT: '1px',   // Hairline border
  2: '2px',
  4: '4px',
  8: '8px',
} as const;

// Box shadow scale (minimal, Linear-inspired)
export const boxShadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Subtle focus ring shadow
  ring: '0 0 0 2px var(--jade-7)',
  ringOffset: '0 0 0 2px var(--slate-1), 0 0 0 4px var(--jade-7)',
} as const;

// Z-index scale
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',
  20: '20',
  30: '30',
  40: '40',
  50: '50',     // Dropdowns, tooltips
  100: '100',   // Sticky headers
  200: '200',   // Modals
  300: '300',   // Toasts, notifications
  9999: '9999', // Maximum overlay
} as const;

// Transition durations
export const transitionDuration = {
  75: '75ms',
  100: '100ms',
  150: '150ms',   // Fast interactions (hover)
  200: '200ms',   // Default
  300: '300ms',   // Moderate (expand/collapse)
  500: '500ms',   // Slow (page transitions)
  700: '700ms',
  1000: '1000ms',
} as const;

// Transition timing functions
export const transitionTimingFunction = {
  DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)', // ease-out
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const layoutTokens = {
  spacing,
  borderRadius,
  borderWidth,
  boxShadow,
  zIndex,
  transitionDuration,
  transitionTimingFunction,
} as const;
