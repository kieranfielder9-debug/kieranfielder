import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Polygon, Circle } from 'react-native-svg';
import { theme } from '../theme';
import { useFinance, HarvestMode, InvestmentMode } from '../state/FinanceContext';
import { yieldCurve, financialGoals, givingTargets } from '../data/mockFinance';
import { AppHeader } from '../components/AppHeader';
import { Card, SectionTitle, Label, Meta, ValueEmphasis, Chip, TrackBar, ShowMore, PrimaryButton, Row } from '../components/primitives';
import type { RootNavigationProp } from '../navigation/types';

const HARVEST_MODES: HarvestMode[] = ['Standard', 'Bull', 'Bear', 'Jubilee'];
const INVESTMENT_MODES: InvestmentMode[] = ['Standard', 'Personalise', 'Auto'];

export function PlanningScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { harvestMode, setHarvestMode, investmentMode, setInvestmentMode } = useFinance();

  const visibleGoals = financialGoals.slice(0, 3);
  const hiddenGoals = financialGoals.slice(3);

  return (
    <View style={styles.screen}>
      <AppHeader title="PLANNING" />

      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Harvest Projections</SectionTitle>

        <View style={{ gap: theme.spacing.sm }}>
          <Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>Harvest Mode</Meta>
          <View style={styles.pillRow}>
            {HARVEST_MODES.map((mode) => (
              <Chip key={mode} label={mode} active={mode === harvestMode} onPress={() => setHarvestMode(mode)} />
            ))}
          </View>
        </View>

        <Card style={{ gap: theme.spacing.sm }}>
          <View style={styles.rowBetween}>
            <Label>Harvest Yield Curve</Label>
            <Meta>{harvestMode} mode</Meta>
          </View>
          <YieldCurveChart />
          <View style={styles.rowBetween}>
            {yieldCurve.points.map((point) => (
              <Meta key={point.month} style={{ fontSize: 10 }}>{point.label}</Meta>
            ))}
          </View>
          <View style={[styles.rowBetween, styles.divider]}>
            <ValueEmphasis>Est. Yield: £{yieldCurve.estYield.toLocaleString()}</ValueEmphasis>
            <Meta>Harvest Horizon: {yieldCurve.horizonMonths} Mos</Meta>
          </View>
        </Card>

        <Card style={{ gap: theme.spacing.lg }}>
          <Text style={styles.cardHeading}>Financial Goals &amp; Targets</Text>
          {visibleGoals.map((goal) => (
            <GoalRow key={goal.id} name={goal.name} percent={goal.percent} target={goal.target} />
          ))}
          {hiddenGoals.length > 0 && (
            <ShowMore hiddenCount={hiddenGoals.length}>
              {hiddenGoals.map((goal) => (
                <GoalRow key={goal.id} name={goal.name} percent={goal.percent} target={goal.target} />
              ))}
            </ShowMore>
          )}
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <SectionTitle>Giving Targets</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.md }}>
            {givingTargets.map((target) => (
              <Card key={target.id} style={styles.givingCard}>
                <TargetRing percent={Math.min(100, (target.given / target.target) * 100)} />
                <Label>{target.name}</Label>
                <Meta style={{ textAlign: 'center' }}>£{target.given} / £{target.target}</Meta>
              </Card>
            ))}
          </ScrollView>
        </View>

        <Card style={{ gap: theme.spacing.md }}>
          <Text style={styles.cardHeading}>Investments</Text>
          <View style={styles.segmented}>
            {INVESTMENT_MODES.map((mode) => (
              <Chip key={mode} label={mode} active={mode === investmentMode} onPress={() => setInvestmentMode(mode)} />
            ))}
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Row left={<Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>Products</Meta>} right={<View />} />
            <Row left={<Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>Insights</Meta>} right={<View />} />
            <Row left={<Meta style={{ fontWeight: '600', color: theme.colors.neutral[600] }}>Portfolios</Meta>} right={<View />} />
          </View>
          <PrimaryButton label="+ Deploy Capital / New Investment" onPress={() => navigation.navigate('DeployCapital')} />
        </Card>
      </ScrollView>
    </View>
  );
}

function GoalRow({ name, percent, target }: { name: string; percent: number; target: number }) {
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={styles.rowBetween}>
        <Label>{name}</Label>
        <Meta>{percent}% · Target £{target.toLocaleString()}</Meta>
      </View>
      <TrackBar percent={percent} />
    </View>
  );
}

function YieldCurveChart() {
  const points = '0,172 100,148 200,109 300,31';
  return (
    <Svg width="100%" height={140} viewBox="0 0 300 200" preserveAspectRatio="none">
      <Polygon points={`${points} 300,196 0,196`} fill={theme.colors.neutral[600]} fillOpacity={0.08} />
      <Polyline points={points} fill="none" stroke={theme.colors.neutral[800]} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={300} cy={31} r={4.6} fill={theme.colors.neutral[800]} />
    </Svg>
  );
}

function TargetRing({ percent }: { percent: number }) {
  const rings = [26, 20, 14, 7];
  const filledShades = [theme.colors.neutral[500], theme.colors.neutral[600], theme.colors.neutral[700], theme.colors.neutral[800]];
  const filledRings = Math.max(1, Math.round((percent / 100) * rings.length));
  return (
    <Svg width={60} height={60} viewBox="0 0 60 60">
      {rings.map((radius, index) => (
        <Circle
          key={radius}
          cx={30}
          cy={30}
          r={radius}
          fill={index < filledRings ? filledShades[index] : theme.colors.neutral[100]}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  divider: { borderTopWidth: theme.borderWidth.default, borderTopColor: theme.colors.neutral[100], paddingTop: theme.spacing.sm },
  cardHeading: { ...theme.text.t2, fontSize: 14, color: theme.colors.neutral[800] },
  givingCard: { width: 110, alignItems: 'center', gap: theme.spacing.xs },
  segmented: { flexDirection: 'row', gap: theme.spacing.xs },
});
