/**
 * Design Tokens Index
 *
 * Central export for all design tokens.
 * Import tokens from here for consistent access across the application.
 */

export * from './colors';
export * from './typography';
export * from './spacing';

// Re-export commonly used tokens directly
export {
  jade,
  jadeDark,
  pink,
  pinkDark,
  slate,
  slateDark,
  red,
  redDark,
  colors,
} from './colors';

export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
  typography,
} from './typography';

export {
  spacing,
  borderRadius,
  borderWidth,
  boxShadow,
  zIndex,
  transitionDuration,
  transitionTimingFunction,
  layoutTokens,
} from './spacing';
