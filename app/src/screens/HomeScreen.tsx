import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../theme';
import { useSecurity } from '../state/SecurityContext';
import { useFinance } from '../state/FinanceContext';
import { useToast } from '../state/ToastContext';
import { AppHeader } from '../components/AppHeader';
import { Card, SectionTitle, Label, Meta, Callout, PrimaryButton, OutlineButton } from '../components/primitives';
import type { RootNavigationProp } from '../navigation/types';

const ACTIVITY_GROUP_LABELS = {
  purchases: 'Purchases',
  cancelledPurchases: 'Cancelled Purchases',
  streamAllocations: 'Stream Allocations',
  kingdomImpacts: 'Kingdom Impacts',
} as const;

export function HomeScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { shouldBalancesBlur } = useSecurity();
  const { isLoading, isOffline, totalValue, healthScore, recentActivity } = useFinance();
  const { showToast } = useToast();

  const groupedActivity = groupActivityByType(recentActivity);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader alertCount={2} showSearch />
        <View style={styles.loadingWrap}>
          <Meta>Loading your Storehouse…</Meta>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader alertCount={2} showSearch />

      <ScrollView contentContainerStyle={styles.content}>
        {isOffline && <Callout>Can't reach the server right now — showing your last saved data.</Callout>}

        <View style={{ gap: theme.spacing.xs }}>
          <Label>Total Storehouse Value</Label>
          <Text style={styles.heroValue}>{shouldBalancesBlur ? '••••••' : `£${totalValue.toFixed(2)}`}</Text>
        </View>

        <Card>
          <Label>Storehouse Cube</Label>
          <StorehouseCube />
          <Meta style={{ textAlign: 'center' }}>3D Storehouse — stocked with Gold, Streams &amp; Commodities</Meta>
        </Card>

        <Card>
          <View style={styles.healthRow}>
            <Label>Health Score</Label>
            <Text style={styles.healthValue}>
              {healthScore}
              <Text style={styles.healthValueMuted}>/100</Text>
            </Text>
          </View>
          <View style={styles.healthTrack}>
            <View style={[styles.healthFill, { width: `${healthScore}%` }]} />
          </View>
          <Meta style={{ textAlign: 'center' }}>Your stewardship health this month</Meta>
        </Card>

        <View style={styles.actionsRow}>
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Label>Primary Actions</Label>
            <View style={styles.actionGrid}>
              <ActionButton label="Transfer" primary onPress={() => navigation.navigate('Transfer')} />
              <ActionButton label="Allocate" onPress={() => showToast('Open the Allocation tab to manage streams', 'info')} />
              <ActionButton label="Scheduled" onPress={() => showToast('No scheduled payments yet', 'info')} />
              <ActionButton label="Tithe" onPress={() => showToast('Set up a tithe stream from Allocation', 'info')} />
            </View>
          </View>
          <Card style={styles.alertsCard}>
            <Label style={{ textAlign: 'center' }}>Alerts</Label>
            <Meta style={{ textAlign: 'center' }}>2 Pending Approvals</Meta>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <SectionTitle>Recent Activity Stream</SectionTitle>
          <Card>
            {Object.entries(groupedActivity).map(([group, items]) => (
              <View key={group} style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
                <Text style={styles.groupLabel}>{ACTIVITY_GROUP_LABELS[group as keyof typeof ACTIVITY_GROUP_LABELS]}</Text>
                {items.map((item) => (
                  <View key={item.id} style={styles.activityRow}>
                    <Meta style={{ color: theme.colors.neutral[600] }}>{item.label}</Meta>
                    <Text style={styles.activityAmount}>
                      {item.amount >= 0 ? '+' : '-'}£{Math.abs(item.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function StorehouseCube() {
  return (
    <Svg width="100%" height={180} viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">
      <Polygon points="150,30 250,85 150,140 50,85" fill={theme.colors.neutral[100]} stroke={theme.colors.neutral[300]} strokeWidth={1.5} />
      <Polygon points="50,85 150,140 150,270 50,215" fill={theme.colors.neutral[200]} stroke={theme.colors.neutral[300]} strokeWidth={1.5} />
      <Polygon points="150,140 250,85 250,215 150,270" fill={theme.colors.neutral[300]} stroke={theme.colors.neutral[400]} strokeWidth={1.5} />
    </Svg>
  );
}

type ActionButtonProps = { label: string; onPress: () => void; primary?: boolean };

function ActionButton({ label, onPress, primary }: ActionButtonProps) {
  return primary ? (
    <PrimaryButton label={label} onPress={onPress} style={styles.actionButton} />
  ) : (
    <OutlineButton label={label} onPress={onPress} style={styles.actionButton} />
  );
}

function groupActivityByType<T extends { group: string }>(items: T[]) {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }
  return groups;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  heroValue: { ...theme.text.t1, color: theme.colors.neutral[800] },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: theme.spacing.sm },
  healthValue: { fontSize: 20, fontWeight: '700', color: theme.colors.neutral[800] },
  healthValueMuted: { fontSize: 12, fontWeight: '600', color: theme.colors.neutral[400] },
  healthTrack: { height: 14, borderRadius: 7, backgroundColor: theme.colors.neutral[100], overflow: 'hidden', marginBottom: theme.spacing.sm },
  healthFill: { height: '100%', backgroundColor: theme.colors.neutral[500], borderRadius: 7 },
  actionsRow: { flexDirection: 'row', gap: theme.spacing.md },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  actionButton: { width: 80, paddingVertical: theme.spacing.sm },
  alertsCard: { width: 118, justifyContent: 'center', gap: theme.spacing.xs },
  groupLabel: { ...theme.text.t3, fontSize: 10, color: theme.colors.neutral[600] },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.xs, borderBottomWidth: theme.borderWidth.default, borderBottomColor: theme.colors.neutral[50] },
  activityAmount: { ...theme.text.t4, fontWeight: '600', color: theme.colors.neutral[600] },
});
