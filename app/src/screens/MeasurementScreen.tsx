import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { useFinance } from '../state/FinanceContext';
import { growthTrackers, jubileeCountdown, wellspringLegend, pruneSuggestions } from '../data/mockFinance';
import { AppHeader } from '../components/AppHeader';
import { Card, SectionTitle, Label, Meta, Callout, Chip, DialGauge, ShowMore, PrimaryButton, Row } from '../components/primitives';
import type { RootNavigationProp } from '../navigation/types';

const JUBILEE_CHIPS = ['Metrics', 'Acceleration', 'Planning', 'Other'];

export function MeasurementScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { kingdomImpactLog } = useFinance();
  const [activeChip, setActiveChip] = useState('Metrics');

  const visibleImpact = kingdomImpactLog.slice(0, 3);
  const hiddenImpact = kingdomImpactLog.slice(3);

  return (
    <View style={styles.screen}>
      <AppHeader title="MEASUREMENT" />

      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Growth Tracker &amp; Impact</SectionTitle>

        <Card style={{ gap: theme.spacing.md }}>
          <Text style={styles.cardHeading}>Growth Trackers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerRow}>
            {growthTrackers.map((tracker, index) => (
              <View key={tracker.id} style={[styles.trackerItem, tracker.locked && styles.trackerLocked]}>
                <View style={styles.trackerRingRow}>
                  <Text style={styles.trackerIndex}>{index + 1}</Text>
                  <DialGauge percent={tracker.percent} size={56 + index * 18} />
                </View>
                <Meta>{tracker.label}</Meta>
              </View>
            ))}
          </ScrollView>
          <Meta style={{ textAlign: 'center' }}>Scroll to explore each season's growth in detail</Meta>
        </Card>

        <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Text style={styles.cardHeading}>Jubilee Countdown</Text>
          <View style={styles.lcdRow}>
            <LcdDigit value={jubileeCountdown.months} unit="MO" />
            <Text style={styles.lcdColon}>:</Text>
            <LcdDigit value={jubileeCountdown.weeks} unit="WK" />
            <Text style={styles.lcdColon}>:</Text>
            <LcdDigit value={jubileeCountdown.days} unit="DY" />
          </View>
          <Callout>On pace for Jubilee at your current giving rate — {jubileeCountdown.daysToGo} days to go</Callout>
          <View style={styles.chipRow}>
            {JUBILEE_CHIPS.map((chip) => (
              <Chip key={chip} label={chip} active={chip === activeChip} onPress={() => setActiveChip(chip)} />
            ))}
          </View>
        </Card>

        <Card style={{ gap: theme.spacing.sm }}>
          <Label>Kingdom Impact</Label>
          <View style={{ gap: theme.spacing.sm }}>
            {visibleImpact.map((item) => (
              <ImpactRow key={item.id} title={item.title} subtitle={item.subtitle} amountLabel={item.amountLabel} />
            ))}
          </View>
          {hiddenImpact.length > 0 && (
            <ShowMore hiddenCount={hiddenImpact.length}>
              {hiddenImpact.map((item) => (
                <ImpactRow key={item.id} title={item.title} subtitle={item.subtitle} amountLabel={item.amountLabel} />
              ))}
            </ShowMore>
          )}
          <PrimaryButton label="+ Add Your Own Impact" onPress={() => navigation.navigate('LogKingdomImpact')} />
        </Card>

        <Card style={{ gap: theme.spacing.sm }}>
          <Label>Prune Suggestions</Label>
          <View style={{ gap: theme.spacing.sm }}>
            {pruneSuggestions.map((item) => (
              <Row key={item.id} left={<Meta style={{ color: theme.colors.neutral[600] }}>{item.label}</Meta>} right={<Text style={styles.metricLabel}>{item.metricLabel}</Text>} />
            ))}
          </View>
          <PrimaryButton label="Review &amp; Prune" onPress={() => navigation.navigate('PrunePayments')} />
        </Card>

        <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Label style={{ alignSelf: 'flex-start' }}>Wellspring</Label>
          <View style={styles.wellspringRings}>
            {[65, 50, 35, 20].map((size, index) => (
              <View
                key={size}
                style={[
                  styles.wellspringRing,
                  { width: size, height: size, borderRadius: size / 2, backgroundColor: [theme.colors.flow.light, theme.colors.flow.base, theme.colors.flow.dark, theme.colors.neutral[800]][index] },
                ]}
              />
            ))}
          </View>
          <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
            {wellspringLegend.map((item, index) => (
              <View key={item.id} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.legendDot, { backgroundColor: [theme.colors.flow.light, theme.colors.flow.base, theme.colors.flow.dark][index] }]} />
                  <Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>{item.label}</Meta>
                </View>
                <Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>£{item.amount.toLocaleString()}</Meta>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function LcdDigit({ value, unit }: { value: number; unit: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.lcdNum}>{value.toString().padStart(2, '0')}</Text>
      <Text style={styles.lcdUnit}>{unit}</Text>
    </View>
  );
}

function ImpactRow({ title, subtitle, amountLabel }: { title: string; subtitle: string; amountLabel: string }) {
  return (
    <Row
      left={
        <View>
          <Text style={styles.impactTitle}>{title}</Text>
          <Meta>{subtitle}</Meta>
        </View>
      }
      right={<Text style={styles.metricLabel}>{amountLabel}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  cardHeading: { ...theme.text.t2, fontSize: 14, color: theme.colors.neutral[800] },
  trackerRow: { gap: theme.spacing.xl, alignItems: 'flex-end', paddingVertical: theme.spacing.sm },
  trackerItem: { alignItems: 'center', gap: theme.spacing.sm },
  trackerLocked: { opacity: 0.5 },
  trackerRingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  trackerIndex: { fontSize: 18, fontWeight: '700', color: theme.colors.neutral[800] },
  lcdRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.neutral[800], borderRadius: theme.radius.md - 4, padding: theme.spacing.md, alignSelf: 'stretch', justifyContent: 'center' },
  lcdNum: { fontFamily: 'Courier New', fontSize: 24, fontWeight: '700', color: theme.colors.neutral[0] },
  lcdUnit: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: theme.colors.neutral[300] },
  lcdColon: { fontSize: 20, color: theme.colors.neutral[500] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, justifyContent: 'center' },
  metricLabel: { ...theme.text.t4, fontWeight: '600', color: theme.colors.neutral[600] },
  impactTitle: { ...theme.text.t4, fontWeight: '700', color: theme.colors.neutral[600] },
  wellspringRings: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  wellspringRing: { position: 'absolute' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
});
