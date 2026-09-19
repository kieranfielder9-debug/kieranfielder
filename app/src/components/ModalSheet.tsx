import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';

type ModalSheetProps = { title: string; children: ReactNode };

export function ModalSheet({ title, children }: ModalSheetProps) {
  const navigation = useNavigation();

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.overlayTapArea} onPress={() => navigation.goBack()}>
        <View style={styles.closeRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.neutral[0]} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
          <Text style={styles.closeLabel}>Close</Text>
        </View>
      </Pressable>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(24,24,27,0.45)', justifyContent: 'flex-end' },
  overlayTapArea: { flex: 1, padding: theme.spacing.lg },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  closeLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.neutral[0] },
  sheet: {
    backgroundColor: theme.colors.neutral[0],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.neutral[300], alignSelf: 'center' },
  title: { ...theme.text.t2, color: theme.colors.neutral[800] },
});
