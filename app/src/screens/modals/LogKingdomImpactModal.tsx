import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFinance } from '../../state/FinanceContext';
import { ModalSheet } from '../../components/ModalSheet';
import { TextField, PrimaryButton } from '../../components/primitives';

export function LogKingdomImpactModal() {
  const navigation = useNavigation();
  const { logImpact } = useFinance();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

  const canLog = description.length > 0 && amount.length > 0;

  function handleLog() {
    logImpact(description, `£${amount}`);
    navigation.goBack();
  }

  return (
    <ModalSheet title="Log Kingdom Impact">
      <TextField
        label="What did you give toward?"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Local food bank drive"
        maxLength={48}
        helperText="48 characters max"
      />
      <TextField label="Amount" value={amount} onChangeText={setAmount} placeholder="£0.00" keyboardType="numeric" />
      <TextField label="Date" value={date} onChangeText={setDate} placeholder="Today" />
      <PrimaryButton label="Log Impact" onPress={handleLog} disabled={!canLog} />
    </ModalSheet>
  );
}
