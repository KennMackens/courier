/**
 * Theme Configuration
 *
 * Provides CSS custom properties for Radix color scales
 * and theme-aware color mappings.
 */

import {
  jade,
  jadeDark,
  pink,
  pinkDark,
  slate,
  slateDark,
  red,
  redDark,
} from './tokens/colors';

/**
 * Generate CSS custom properties for a color scale
 */
function colorScaleToCssVars(
  scale: Record<string, string>,
  prefix: string
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(scale)) {
    vars[`--${prefix}-${key}`] = value;
  }
  return vars;
}

/**
 * Light mode CSS custom properties
 */
export const lightThemeVars = {
  // Jade (Primary)
  ...colorScaleToCssVars(jade, 'jade'),
  // Pink (Accent)
  ...colorScaleToCssVars(pink, 'pink'),
  // Slate (Neutral)
  ...colorScaleToCssVars(slate, 'slate'),
  // Red (Destructive)
  ...colorScaleToCssVars(red, 'red'),

  // Semantic mappings
  '--background': slate[1],
  '--foreground': slate[12],
  '--card': slate[1],
  '--card-foreground': slate[12],
  '--popover': slate[1],
  '--popover-foreground': slate[12],
  '--primary': jade[9],
  '--primary-foreground': '#ffffff',
  '--secondary': slate[3],
  '--secondary-foreground': slate[12],
  '--muted': slate[3],
  '--muted-foreground': slate[11],
  '--accent': pink[9],
  '--accent-foreground': '#ffffff',
  '--destructive': red[9],
  '--destructive-foreground': '#ffffff',
  '--border': slate[6],
  '--input': slate[6],
  '--ring': jade[7],
};

/**
 * Dark mode CSS custom properties
 */
export const darkThemeVars = {
  // Jade Dark (Primary)
  ...colorScaleToCssVars(jadeDark, 'jade'),
  // Pink Dark (Accent)
  ...colorScaleToCssVars(pinkDark, 'pink'),
  // Slate Dark (Neutral)
  ...colorScaleToCssVars(slateDark, 'slate'),
  // Red Dark (Destructive)
  ...colorScaleToCssVars(redDark, 'red'),

  // Semantic mappings
  '--background': slateDark[1],
  '--foreground': slateDark[12],
  '--card': slateDark[2],
  '--card-foreground': slateDark[12],
  '--popover': slateDark[2],
  '--popover-foreground': slateDark[12],
  '--primary': jadeDark[9],
  '--primary-foreground': '#ffffff',
  '--secondary': slateDark[3],
  '--secondary-foreground': slateDark[12],
  '--muted': slateDark[3],
  '--muted-foreground': slateDark[11],
  '--accent': pinkDark[9],
  '--accent-foreground': '#ffffff',
  '--destructive': redDark[9],
  '--destructive-foreground': '#ffffff',
  '--border': slateDark[6],
  '--input': slateDark[6],
  '--ring': jadeDark[7],
};

/**
 * Generate CSS string for theme variables
 */
export function generateThemeCss(): string {
  const formatVars = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n');

  return `
:root {
${formatVars(lightThemeVars)}
}

.dark {
${formatVars(darkThemeVars)}
}
`.trim();
}

export const theme = {
  light: lightThemeVars,
  dark: darkThemeVars,
  generateCss: generateThemeCss,
};
