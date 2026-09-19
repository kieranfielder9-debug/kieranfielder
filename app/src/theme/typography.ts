import { TextStyle } from 'react-native';

/**
 * NOTE: naming a custom font family here does not make it render. 'Syne' and
 * 'Clash Display' must be loaded as font assets (via expo-font /
 * @expo-google-fonts/syne) before React Native will recognize the name —
 * until that's done, these fall back to the system font. Loading the actual
 * font files is a follow-up task, not part of this one.
 */
export const fontFamily = {
  display: 'Syne',
  /** Approved pairing direction — not yet wired into any prototype. Falls
   *  back to Syne until the font asset is loaded. */
  displayNumeric: 'Clash Display',
  body: undefined, // system default (SF Pro on iOS, Roboto on Android)
} as const;

/** Hero numbers only — max one per screen. */
export const t1: TextStyle = {
  fontFamily: fontFamily.display,
  fontSize: 38,
  fontWeight: '800',
  letterSpacing: -0.4, // -0.01em @ 38px
  lineHeight: 42,
};

/** Section titles — one per major section. */
export const t2: TextStyle = {
  fontFamily: fontFamily.display,
  fontSize: 18,
  fontWeight: '700',
  lineHeight: 23,
};

/** Card/module eyebrow labels. */
export const t3: TextStyle = {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.9, // 0.08em @ 11px
  lineHeight: 14,
  textTransform: 'uppercase',
};

/** Secondary numeric emphasis inside a card (Est. Yield, vault balances) —
 *  sits between T2 and T4. */
export const t3n: TextStyle = {
  fontSize: 15,
  fontWeight: '700',
};

/** Body copy, meta, list details. */
export const t4: TextStyle = {
  fontSize: 12,
  fontWeight: '400',
  lineHeight: 17,
};

export const textStyles = { t1, t2, t3, t3n, t4 } as const;
