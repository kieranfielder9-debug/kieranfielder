import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { HomeIcon } from './icons';
import { theme } from '../theme';

export function HomeTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const isSelected = accessibilityState?.selected ?? false;

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <View style={styles.circle}>
        <HomeIcon color={theme.colors.neutral[0]} size={24} />
      </View>
      <Text style={[styles.label, isSelected && styles.labelActive]}>Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: theme.spacing.xs },
  circle: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.neutral[800],
    borderWidth: theme.borderWidth.accentRing,
    borderColor: theme.colors.gold[500],
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -16 }],
    ...theme.shadows.fab,
  },
  label: { ...theme.text.t4, color: theme.colors.neutral[400], fontWeight: '700', transform: [{ translateY: -12 }] },
  labelActive: { color: theme.colors.neutral[800] },
});
