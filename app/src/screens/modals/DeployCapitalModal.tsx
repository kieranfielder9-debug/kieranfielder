import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFinance } from '../../state/FinanceContext';
import { ModalSheet } from '../../components/ModalSheet';
import { TextField, ChipSelect, PrimaryButton } from '../../components/primitives';

const DESTINATIONS = ['Gold & Streams', 'Kingdom Fund'] as const;

export function DeployCapitalModal() {
  const navigation = useNavigation();
  const { deployCapital } = useFinance();

  const [destination, setDestination] = useState<(typeof DESTINATIONS)[number]>('Gold & Streams');
  const [amount, setAmount] = useState('');

  const canDeploy = amount.length > 0;

  function handleDeploy() {
    deployCapital(Number(amount), destination);
    navigation.goBack();
  }

  return (
    <ModalSheet title="Deploy Capital">
      <ChipSelect label="Destination" options={DESTINATIONS} value={destination} onChange={setDestination} />
      <TextField label="Amount" value={amount} onChangeText={setAmount} placeholder="£0.00" keyboardType="numeric" />
      <PrimaryButton label="Deploy Capital" onPress={handleDeploy} disabled={!canDeploy} />
    </ModalSheet>
  );
}
