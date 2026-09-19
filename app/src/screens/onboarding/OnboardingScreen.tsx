import { View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useSecurity } from '../../state/SecurityContext';
import { linkBank } from '../../services/plaid';
import { PrimaryButton, Meta } from '../../components/primitives';
import { theme } from '../../theme';

type OnboardingState =
  | { step: 'welcome' }
  | { step: 'connectBank'; isConnecting: boolean }
  | { step: 'confirmGoals'; selectedGoals: string[] }
  | { step: 'complete' };

const AVAILABLE_GOALS = ['Emergency Vault', 'Debt Freedom', 'Tithe Consistency'];

export function OnboardingScreen() {
  const [state, setState] = useState<OnboardingState>({ step: 'welcome' });
  const { completeOnboarding } = useSecurity();

  async function handleConnectBank() {
    setState({ step: 'connectBank', isConnecting: true });
    await linkBank();
    setState({ step: 'confirmGoals', selectedGoals: [] });
  }

  function toggleGoal(goal: string) {
    if (state.step !== 'confirmGoals') return;
    const alreadySelected = state.selectedGoals.includes(goal);
    setState({
      step: 'confirmGoals',
      selectedGoals: alreadySelected
        ? state.selectedGoals.filter((item) => item !== goal)
        : [...state.selectedGoals, goal],
    });
  }

  return (
    <View style={styles.container}>
      {state.step === 'welcome' && (
        <>
          <Text style={styles.heading}>Welcome to Storehouse</Text>
          <Meta>A stewardship companion for everything you've been entrusted with.</Meta>
          <PrimaryButton label="Get started" onPress={() => setState({ step: 'connectBank', isConnecting: false })} style={styles.button} />
        </>
      )}

      {state.step === 'connectBank' && (
        <>
          <Text style={styles.heading}>Connect your bank</Text>
          <Meta>Storehouse reads your balances and transactions to build your Watchtower and Health Score.</Meta>
          <PrimaryButton
            label={state.isConnecting ? 'Connecting…' : 'Connect with Plaid'}
            onPress={handleConnectBank}
            disabled={state.isConnecting}
            style={styles.button}
          />
        </>
      )}

      {state.step === 'confirmGoals' && (
        <>
          <Text style={styles.heading}>What matters to you?</Text>
          <Meta>Pick as many as apply — you can change these later.</Meta>
          <View style={styles.goalList}>
            {AVAILABLE_GOALS.map((goal) => {
              const isSelected = state.selectedGoals.includes(goal);
              return (
                <PrimaryButton
                  key={goal}
                  label={isSelected ? `✓ ${goal}` : goal}
                  onPress={() => toggleGoal(goal)}
                  style={isSelected ? styles.goalSelected : styles.goalUnselected}
                />
              );
            })}
          </View>
          <PrimaryButton label="Continue" onPress={() => setState({ step: 'complete' })} style={styles.button} />
        </>
      )}

      {state.step === 'complete' && (
        <>
          <Text style={styles.heading}>You're all set</Text>
          <Meta>Your Storehouse is ready.</Meta>
          <PrimaryButton label="Enter Storehouse" onPress={completeOnboarding} style={styles.button} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  heading: { ...theme.text.t1, fontSize: 24, color: theme.colors.neutral[800], textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: theme.spacing.lg },
  goalList: { alignSelf: 'stretch', gap: theme.spacing.sm },
  goalSelected: { backgroundColor: theme.colors.gold[600] },
  goalUnselected: {},
});
