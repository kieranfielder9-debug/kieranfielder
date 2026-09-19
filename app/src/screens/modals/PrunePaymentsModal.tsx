import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { useFinance } from '../../state/FinanceContext';
import { ModalSheet } from '../../components/ModalSheet';
import { PrimaryButton, Meta } from '../../components/primitives';

function parseMonthlyAmount(amountLabel: string) {
  return Number(amountLabel.replace(/[£/mo]/g, ''));
}

export function PrunePaymentsModal() {
  const navigation = useNavigation();
  const { expenseAudit, prunePayment } = useFinance();
  const [selectedIds, setSelectedIds] = useState<string[]>(expenseAudit.map((item) => item.id));

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const selectedItems = expenseAudit.filter((item) => selectedIds.includes(item.id));
  const monthlySavings = selectedItems.reduce((total, item) => total + parseMonthlyAmount(item.amountLabel), 0);

  function handleCancelSelected() {
    selectedItems.forEach((item) => prunePayment(item.id));
    navigation.goBack();
  }

  return (
    <ModalSheet title="Prune Payments">
      <Meta>Select which flagged payments to cancel</Meta>
      <View style={{ gap: theme.spacing.sm }}>
        {expenseAudit.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <Pressable key={item.id} style={styles.row} onPress={() => toggle(item.id)}>
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]} />
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowAmount}>{item.amountLabel}</Text>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        label={`Cancel Selected (${selectedItems.length}) — Save £${monthlySavings.toFixed(2)}/mo`}
        onPress={handleCancelSelected}
        disabled={selectedItems.length === 0}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[100],
    borderRadius: theme.radius.md - 6,
    padding: theme.spacing.md,
  },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: theme.borderWidth.default, borderColor: theme.colors.neutral[300] },
  checkboxChecked: { backgroundColor: theme.colors.neutral[800], borderColor: theme.colors.neutral[800] },
  rowLabel: { flex: 1, ...theme.text.t4, fontWeight: '600', color: theme.colors.neutral[600] },
  rowAmount: { ...theme.text.t4, fontWeight: '600', color: theme.colors.neutral[600] },
});
