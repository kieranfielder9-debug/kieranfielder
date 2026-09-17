/**
 * Storehouse color ramps — ported from design-tokens.json.
 *
 * Gold and Neutral are full 10-step ramps. Flow, Success, Error, and Warning
 * are deliberately small 3-step reserved scales, not general chrome — see
 * DESIGN-DECISIONS.md and the state matrix for where each is allowed to appear.
 */

export const gold = {
  50: '#FBF0D4',
  100: '#F7E2A8',
  200: '#F3D77A',
  300: '#E3C158',
  400: '#D3AD3C',
  500: '#C9A227', // primary / border-strong
  600: '#A8841E',
  700: '#8A6414', // primary-dark
  800: '#6B4D0F',
  900: '#5C4210',
} as const;

export const neutral = {
  0: '#FFFFFF', // surface
  50: '#F7EED8', // page background
  100: '#ECD9A0', // default border
  200: '#D9C48F',
  300: '#B9A47A',
  400: '#8C7A52', // muted / secondary text
  500: '#6E5D3D',
  600: '#4A3818', // ink-soft
  700: '#362912',
  800: '#241A0C', // ink — primary text
  900: '#140E06',
} as const;

/** Reserved exclusively for money-in-motion visuals (Stream Splitter,
 *  Wellspring). Never used as general UI chrome. */
export const flow = {
  light: '#9AB4C4',
  base: '#6B8CA3',
  dark: '#4C6E82',
} as const;

/** Reserved for discrete completed events only (a finished transfer, a
 *  reached goal) — never for routine positive amounts. Warm heraldic hunter
 *  green, chosen to pair with Gold rather than clash against it. */
export const success = {
  light: '#E1EAD9',
  base: '#3A5F3E',
  dark: '#223923',
} as const;

/** Deep brick/oxblood, same heraldic-with-gold logic as success — never a
 *  fire-engine red. Used for hard-block validation and failed actions. */
export const error = {
  light: '#F0D9D2',
  base: '#8C3B2E',
  dark: '#4A1F18',
} as const;

/** Soft-constraint validation (risky but valid) — distinct hue from both
 *  Gold and Error so "brand accent" and "caution" never collide.
 *  NOTE: only `base` was actually decided in design; `light`/`dark` below
 *  are newly derived here to complete the pattern — flag if they're wrong. */
export const warning = {
  light: '#F2E0C9',
  base: '#B8722A',
  dark: '#6B4110',
} as const;
