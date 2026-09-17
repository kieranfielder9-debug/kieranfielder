import { Platform, ViewStyle } from 'react-native';
import { neutral } from './colors';

/**
 * RN has no CSS-style `box-shadow`. iOS reads shadowColor/shadowOffset/
 * shadowOpacity/shadowRadius; Android ignores those entirely and only
 * respects a single `elevation` number (no custom color or offset).
 * Platform.select picks the right shape per OS at runtime.
 *
 * Neomorphic (light shadow + dark shadow on opposite corners) is NOT
 * representable as a single style object at all — RN only applies one
 * shadow per view. That needs a dedicated component (two stacked views,
 * each with its own shadow) built when the Health Score card is built,
 * not a flat token here.
 */

function shadow(offsetY: number, blur: number, opacity: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: neutral[800],
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur / 2, // RN's shadowRadius is roughly half a CSS blur value
    },
    android: {
      elevation: Math.max(1, Math.round(offsetY + blur / 4)),
    },
    default: {},
  })!;
}

export const shadows = {
  card: shadow(4, 16, 0.08),
  searchBar: shadow(2, 8, 0.06),
  /** The Home nav button only — signals "floats above the bar." */
  fab: shadow(4, 10, 0.3),
} as const;
