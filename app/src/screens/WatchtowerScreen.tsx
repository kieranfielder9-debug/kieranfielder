import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { theme } from '../theme';
import { useFinance } from '../state/FinanceContext';
import { expenseCategories } from '../data/mockFinance';
import { AppHeader } from '../components/AppHeader';
import { Card, SectionTitle, Label, Meta, Callout, Chip, Badge, PrimaryButton, Row } from '../components/primitives';
import type { RootNavigationProp } from '../navigation/types';

const TIMEFRAMES = ['1W', '1M', '1Y'] as const;

export function WatchtowerScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { expenseAudit, assessments } = useFinance();
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('1M');

  const maxAmount = Math.max(...expenseCategories.map((category) => category.amount));
  const largestCategory = expenseCategories.reduce((a, b) => (b.amount > a.amount ? b : a));

  return (
    <View style={styles.screen}>
      <AppHeader title="WATCHTOWER" />

      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Watchtower Analytics</SectionTitle>

        <Card style={{ gap: theme.spacing.lg }}>
          <Text style={styles.cardHeading}>Spending Analytics</Text>

          <View style={{ gap: theme.spacing.sm }}>
            <View style={styles.rowBetween}>
              <Label>Expense Categorisation</Label>
              <Meta>This month</Meta>
            </View>
            <View style={styles.barChart}>
              {expenseCategories.map((category) => (
                <View key={category.id} style={styles.barColumn}>
                  <Text style={[styles.barValue, category.active && styles.barValueActive]}>£{category.amount}</Text>
                  <View
                    style={[
                      styles.bar,
                      { height: `${(category.amount / maxAmount) * 100}%` },
                      category.active && styles.barActive,
                    ]}
                  />
                  <Text style={[styles.barLabel, category.active && styles.barLabelActive]}>{category.label}</Text>
                </View>
              ))}
            </View>
            <Callout>{largestCategory.label} is your largest category this month</Callout>
          </View>

          <View style={styles.divider}>
            <Label>Analytics Engine</Label>
            <View style={styles.segmented}>
              {TIMEFRAMES.map((frame) => (
                <Chip key={frame} label={frame} active={frame === timeframe} onPress={() => setTimeframe(frame)} />
              ))}
            </View>
            <LineChartPlaceholder />
            <Meta>Line Graph: Expense Trends &amp; Outflow Patterns</Meta>
          </View>
        </Card>

        <Card style={{ gap: theme.spacing.sm }}>
          <Label>Expense Audit</Label>
          <View style={{ gap: theme.spacing.sm }}>
            {expenseAudit.map((item) => (
              <Row key={item.id} left={<Meta style={{ color: theme.colors.neutral[600] }}>{item.label}</Meta>} right={<Text style={styles.amountLabel}>{item.amountLabel}</Text>} />
            ))}
          </View>
          <PrimaryButton label="Prune Payments" onPress={() => navigation.navigate('PrunePayments')} />
        </Card>

        <Card style={{ gap: theme.spacing.sm }}>
          <Label>Stewardship Profile Assessment</Label>
          <View style={{ gap: theme.spacing.sm }}>
            {assessments.map((assessment) => (
              <Row
                key={assessment.id}
                strong={assessment.status === 'continue'}
                left={
                  <View>
                    <Text style={styles.assessmentTitle}>{assessment.title}</Text>
                    <Meta>{assessment.subtitle}</Meta>
                  </View>
                }
                right={assessment.status === 'completed' ? <Badge label="Completed" /> : <Badge label="Continue" />}
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function LineChartPlaceholder() {
  return (
    <View style={styles.linePlaceholder}>
      <Svg width="100%" height={70} viewBox="0 0 300 90" preserveAspectRatio="none">
        <Polyline
          points="0,70 40,55 80,60 120,35 160,45 200,20 240,30 300,10"
          fill="none"
          stroke={theme.colors.neutral[500]}
          strokeWidth={2.5}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  cardHeading: { ...theme.text.t2, fontSize: 14, color: theme.colors.neutral[800] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barChart: { flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'flex-end', justifyContent: 'center', height: 180, borderBottomWidth: theme.borderWidth.default, borderBottomColor: theme.colors.neutral[100], paddingTop: theme.spacing.sm },
  barColumn: { alignItems: 'center', gap: theme.spacing.xs, height: '100%', justifyContent: 'flex-end', width: 32 },
  bar: { width: 24, backgroundColor: theme.colors.neutral[100], borderRadius: 4 },
  barActive: { backgroundColor: theme.colors.neutral[600] },
  barValue: { ...theme.text.t4, fontWeight: '700', color: theme.colors.neutral[600] },
  barValueActive: { color: theme.colors.neutral[800] },
  barLabel: { ...theme.text.t4, fontSize: 10 },
  barLabelActive: { fontWeight: '700', color: theme.colors.neutral[600] },
  divider: { gap: theme.spacing.sm, borderTopWidth: theme.borderWidth.default, borderTopColor: theme.colors.neutral[100], paddingTop: theme.spacing.lg },
  segmented: { flexDirection: 'row', gap: theme.spacing.xs },
  linePlaceholder: { height: 90, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.neutral[200], borderRadius: theme.radius.md - 6, justifyContent: 'center' },
  amountLabel: { ...theme.text.t4, fontWeight: '600', color: theme.colors.neutral[600] },
  assessmentTitle: { ...theme.text.t4, fontWeight: '700', color: theme.colors.neutral[600] },
});
