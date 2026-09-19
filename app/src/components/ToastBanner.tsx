import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useToast } from '../state/ToastContext';

const TONE_COLORS = {
  success: theme.colors.success.base,
  error: theme.colors.error.base,
  info: theme.colors.neutral[800],
} as const;

export function ToastBanner() {
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + theme.spacing.sm }]} pointerEvents="none">
      <View style={[styles.banner, { backgroundColor: TONE_COLORS[toast.type] }]}>
        <Text style={styles.label}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  banner: { borderRadius: theme.radius.pill, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, maxWidth: '90%' },
  label: { ...theme.text.t4, color: theme.colors.neutral[0], fontWeight: '600' },
});
