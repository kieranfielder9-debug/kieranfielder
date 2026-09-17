import { gold, neutral, flow, success, error, warning } from './colors';
import { fontFamily, textStyles } from './typography';
import { spacing } from './spacing';
import { radius, borderWidth } from './radius';
import { shadows } from './shadows';

export const theme = {
  colors: { gold, neutral, flow, success, error, warning },
  fontFamily,
  text: textStyles,
  spacing,
  radius,
  borderWidth,
  shadows,
} as const;

export type Theme = typeof theme;

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';
export * from './shadows';
