import { View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useSecurity } from '../../state/SecurityContext';
import { useToast } from '../../state/ToastContext';
import { authenticateWithFaceId } from '../../services/biometrics';
import { PrimaryButton, Meta } from '../../components/primitives';
import { theme } from '../../theme';

export function LockScreen() {
  const { unlockApp } = useSecurity();
  const { showToast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  async function handleUnlock() {
    setIsAuthenticating(true);
    const success = await authenticateWithFaceId();
    setIsAuthenticating(false);
    if (success) {
      unlockApp();
    } else {
      showToast('Face ID did not match', 'error');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Storehouse is locked</Text>
      <Meta>Unlock to see your balances and continue stewarding.</Meta>
      <PrimaryButton
        label={isAuthenticating ? 'Checking Face ID…' : 'Unlock with Face ID'}
        onPress={handleUnlock}
        disabled={isAuthenticating}
        style={styles.button}
      />
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
  heading: { ...theme.text.t1, fontSize: 22, color: theme.colors.neutral[800], textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: theme.spacing.lg },
});
