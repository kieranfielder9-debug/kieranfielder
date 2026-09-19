import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../theme';
import { useFinance } from '../state/FinanceContext';
import { useToast } from '../state/ToastContext';
import { streamSplitter } from '../data/mockFinance';
import { AppHeader } from '../components/AppHeader';
import { Card, SectionTitle, Label, Meta, ValueEmphasis, ShowMore, OutlineButton, Row } from '../components/primitives';
import type { RootNavigationProp } from '../navigation/types';

export function AllocationScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { totalValue, unallocatedFunds, vaults } = useFinance();
  const { showToast } = useToast();

  const visibleVaults = vaults.slice(0, 4);
  const hiddenVaults = vaults.slice(4);

  return (
    <View style={styles.screen}>
      <AppHeader title="ALLOCATION" />

      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Portfolio &amp; Allocation Strategy</SectionTitle>

        <Card style={{ gap: theme.spacing.xs }}>
          <View style={styles.rowBetween}>
            <Label>Stream Splitter</Label>
            <Meta>£{totalValue.toLocaleString()} total</Meta>
          </View>
          <StreamSplitterChart />
          <View style={styles.splitterLegend}>
            {streamSplitter.map((stream) => (
              <View key={stream.id} style={{ flex: 1 }}>
                <Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>{stream.name}</Meta>
                <Meta>£{stream.amount.toLocaleString()} · {stream.percent}%</Meta>
              </View>
            ))}
          </View>
        </Card>

        <Row
          strong
          onPress={() => showToast('Unallocated funds are waiting on a rule', 'info')}
          left={
            <View>
              <Label>Unallocated Funds</Label>
              <Meta>Not yet assigned to a stream</Meta>
            </View>
          }
          right={<ValueEmphasis>£{unallocatedFunds.toFixed(2)}</ValueEmphasis>}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Label style={{ alignSelf: 'center' }}>Quick Give &amp; Move</Label>
          <View style={styles.quickGrid}>
            <QuickButton label="Automate" onPress={() => showToast('Automation rules coming soon', 'info')} />
            <QuickButton label="Tithes" onPress={() => showToast('Set up a tithe stream from below', 'info')} />
            <QuickButton label="Offerings" onPress={() => showToast('Set up an offerings stream from below', 'info')} />
            <QuickButton label="Transfer" primary onPress={() => navigation.navigate('Transfer')} />
          </View>
        </View>

        <Card style={{ gap: theme.spacing.sm }}>
          <Label>Vaults</Label>
          <View style={{ gap: theme.spacing.sm }}>
            {visibleVaults.map((vault) => (
              <Row
                key={vault.id}
                left={
                  <View>
                    <Text style={styles.vaultName}>{vault.name}</Text>
                    <Meta>{vault.splitLabel}</Meta>
                  </View>
                }
                right={<ValueEmphasis>£{vault.balance.toFixed(2)}</ValueEmphasis>}
              />
            ))}
          </View>
          {hiddenVaults.length > 0 && (
            <ShowMore hiddenCount={hiddenVaults.length}>
              {hiddenVaults.map((vault) => (
                <Row
                  key={vault.id}
                  left={
                    <View>
                      <Text style={styles.vaultName}>{vault.name}</Text>
                      <Meta>{vault.splitLabel}</Meta>
                    </View>
                  }
                  right={<ValueEmphasis>£{vault.balance.toFixed(2)}</ValueEmphasis>}
                />
              ))}
            </ShowMore>
          )}
          <OutlineButton label="+ Create New Allocation Rule" onPress={() => navigation.navigate('NewAllocationRule')} />
        </Card>
      </ScrollView>
    </View>
  );
}

function StreamSplitterChart() {
  return (
    <Svg width="100%" height={200} viewBox="0 0 350 340" preserveAspectRatio="xMidYMid meet">
      <Path d="M175,8 C168,55 182,95 175,130" fill="none" stroke={theme.colors.flow.light} strokeWidth={34} strokeLinecap="round" />
      <Path d="M175,130 C140,170 80,165 55,215 C32,250 45,285 28,315" fill="none" stroke={theme.colors.flow.base} strokeWidth={30} strokeLinecap="round" />
      <Path d="M175,130 C182,175 163,225 175,262 C184,285 170,300 175,315" fill="none" stroke={theme.colors.flow.dark} strokeWidth={25} strokeLinecap="round" />
    </Svg>
  );
}

function QuickButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable style={[styles.quickButton, primary && styles.quickButtonPrimary]} onPress={onPress}>
      <Text style={[styles.quickButtonLabel, primary && styles.quickButtonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  splitterLegend: { flexDirection: 'row', gap: theme.spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center' },
  quickButton: {
    width: 76,
    height: 68,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[300],
    backgroundColor: theme.colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  quickButtonPrimary: { backgroundColor: theme.colors.neutral[800], borderColor: theme.colors.neutral[800] },
  quickButtonLabel: { ...theme.text.t4, fontWeight: '600', color: theme.colors.neutral[600] },
  quickButtonLabelPrimary: { color: theme.colors.neutral[0] },
  vaultName: { ...theme.text.t4, fontWeight: '700', color: theme.colors.neutral[600] },
});
