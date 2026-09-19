import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { useToast } from '../state/ToastContext';
import { useSecurity } from '../state/SecurityContext';
import { WatchtowerIcon } from '../navigation/icons';

type AppHeaderProps = { title?: string; alertCount?: number; showSearch?: boolean };

export function AppHeader({ title, alertCount = 0, showSearch }: AppHeaderProps) {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { shouldBalancesBlur, toggleBalanceBlur } = useSecurity();

  function handleAvatarPress() {
    toggleBalanceBlur();
    showToast(shouldBalancesBlur ? 'Balances visible' : 'Balances hidden', 'info');
  }

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }

  function handleAlertsPress() {
    showToast(`${alertCount} pending approvals`, 'info');
  }

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.colors.neutral[800]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </Pressable>

        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : (
          <View style={styles.wordmarkRow}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.neutral[800]} strokeWidth={1.6} strokeLinejoin="round">
              <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            </Svg>
            <Text style={styles.wordmark}>STOREHOUSE</Text>
          </View>
        )}

        <View style={styles.rightIcons}>
          <Pressable onPress={handleAlertsPress} style={styles.bellWrap} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.colors.neutral[800]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <Path d="M13.73 21a2 2 0 01-3.46 0" />
            </Svg>
            {alertCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeLabel}>{alertCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={handleAvatarPress} hitSlop={8}>
            <View style={styles.avatar} />
          </Pressable>
        </View>
      </View>

      {showSearch && (
        <View style={styles.searchBar}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.neutral[400]} strokeWidth={2}>
            <Circle cx={11} cy={11} r={7} />
            <Path d="M21 21l-4.3-4.3" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder="Do I have enough money to buy bread?"
            placeholderTextColor={theme.colors.neutral[400]}
          />
        </View>
      )}

      <View style={styles.iconRow}>
        <IconButton>
          <Circle cx={12} cy={8} r={3.2} stroke={theme.colors.neutral[600]} strokeWidth={2} fill="none" />
        </IconButton>
        <IconButton>
          <Rect x={3} y={6} width={18} height={12} rx={2} stroke={theme.colors.neutral[600]} strokeWidth={2} fill="none" />
        </IconButton>
        <View style={styles.iconBtn}>
          <WatchtowerIcon color={theme.colors.neutral[600]} size={16} />
        </View>
        <IconButton>
          <Rect x={3} y={3} width={18} height={18} rx={4} stroke={theme.colors.neutral[600]} strokeWidth={2} fill="none" />
        </IconButton>
      </View>
    </View>
  );
}

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.iconBtn}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        {children}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: theme.colors.neutral[0], borderBottomWidth: theme.borderWidth.default, borderBottomColor: theme.colors.neutral[100] },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  title: { ...theme.text.t3, color: theme.colors.neutral[800] },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  wordmark: { fontSize: 14, fontWeight: '800', letterSpacing: 2, color: theme.colors.neutral[800] },
  rightIcons: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  bellWrap: { position: 'relative' },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.gold[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeLabel: { fontSize: 9, fontWeight: '700', color: theme.colors.neutral[0] },
  avatar: { width: 22, height: 22, borderRadius: theme.radius.full, backgroundColor: theme.colors.neutral[100], borderWidth: theme.borderWidth.default, borderColor: theme.colors.neutral[200] },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[200],
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchInput: { flex: 1, ...theme.text.t4, color: theme.colors.neutral[600] },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
