import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFinance } from '../../state/FinanceContext';
import { useSecurity } from '../../state/SecurityContext';
import { useToast } from '../../state/ToastContext';
import { authenticateWithFaceId } from '../../services/biometrics';
import { ModalSheet } from '../../components/ModalSheet';
import { TextField, ChipSelect, PrimaryButton } from '../../components/primitives';

const SOURCES = ['Available Balance', 'Gold Vault', 'Wellspring Fund'] as const;
const DESTINATIONS = ['Emergency Fund', 'Wellspring Fund', 'Gold Vault', 'Kingdom Impact Fund'] as const;

export function TransferModal() {
  const navigation = useNavigation();
  const { transferFunds } = useFinance();
  const { stepUpThreshold, isFaceIdSetUp } = useSecurity();
  const { showToast } = useToast();

  const [from, setFrom] = useState<(typeof SOURCES)[number]>('Available Balance');
  const [to, setTo] = useState<(typeof DESTINATIONS)[number]>('Emergency Fund');
  const [amount, setAmount] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const canSend = amount.length > 0 && from !== to;

  async function handleTransfer() {
    const needsStepUp = isFaceIdSetUp && Number(amount) >= stepUpThreshold;

    if (needsStepUp) {
      setIsVerifying(true);
      const verified = await authenticateWithFaceId();
      setIsVerifying(false);
      if (!verified) {
        showToast('Face ID verification failed', 'error');
        return;
      }
    }

    transferFunds(Number(amount), to);
    navigation.goBack();
  }

  return (
    <ModalSheet title="Transfer">
      <ChipSelect label="From" options={SOURCES} value={from} onChange={setFrom} />
      <ChipSelect label="To" options={DESTINATIONS} value={to} onChange={setTo} />
      <TextField label="Amount" value={amount} onChangeText={setAmount} placeholder="£0.00" keyboardType="numeric" />
      <PrimaryButton
        label={isVerifying ? 'Confirming with Face ID…' : 'Transfer Funds'}
        onPress={handleTransfer}
        disabled={!canSend || isVerifying}
      />
    </ModalSheet>
  );
}
