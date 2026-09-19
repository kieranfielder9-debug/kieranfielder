import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFinance } from '../../state/FinanceContext';
import { ModalSheet } from '../../components/ModalSheet';
import { TextField, ChipSelect, PrimaryButton } from '../../components/primitives';

const VAULTS = ['Emergency Fund', 'Wellspring Fund', 'Gold Vault'] as const;

export function NewAllocationRuleModal() {
  const navigation = useNavigation();
  const { createAllocationRule } = useFinance();

  const [ruleName, setRuleName] = useState('');
  const [vault, setVault] = useState<(typeof VAULTS)[number]>('Emergency Fund');
  const [percent, setPercent] = useState('');

  const canCreate = percent.length > 0;

  function handleCreate() {
    createAllocationRule(ruleName || vault, Number(percent));
    navigation.goBack();
  }

  return (
    <ModalSheet title="New Allocation Rule">
      <TextField
        label="Rule Name (optional)"
        value={ruleName}
        onChangeText={setRuleName}
        placeholder="e.g. Payday Top-Up"
        maxLength={30}
        helperText="30 characters max"
      />
      <ChipSelect label="Vault" options={VAULTS} value={vault} onChange={setVault} />
      <TextField label="Auto-Split Percentage" value={percent} onChangeText={setPercent} placeholder="e.g. 10" keyboardType="numeric" />
      <PrimaryButton label="Create Rule" onPress={handleCreate} disabled={!canCreate} />
    </ModalSheet>
  );
}
