import { ReactNode } from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastProvider } from '../ToastContext';
import { FinanceProvider, useFinance } from '../FinanceContext';

beforeEach(async () => {
  await AsyncStorage.clear();
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FinanceProvider>{children}</FinanceProvider>
    </ToastProvider>
  );
}

function TestHarness() {
  const { isLoading, totalValue, unallocatedFunds, vaults, expenseAudit, kingdomImpactLog, transferFunds, createAllocationRule, deployCapital, prunePayment, logImpact } =
    useFinance();

  return (
    <>
      <Text testID="loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="total">{totalValue}</Text>
      <Text testID="unallocated">{unallocatedFunds}</Text>
      <Text testID="vault-count">{vaults.length}</Text>
      <Text testID="audit-count">{expenseAudit.length}</Text>
      <Text testID="impact-count">{kingdomImpactLog.length}</Text>
      <Pressable testID="transfer" onPress={() => transferFunds(100, 'Emergency Fund')} />
      <Pressable testID="create-rule" onPress={() => createAllocationRule('Payday Top-Up', 10)} />
      <Pressable testID="deploy" onPress={() => deployCapital(50, 'Gold & Streams')} />
      <Pressable testID="prune" onPress={() => prunePayment(expenseAudit[0]?.id)} />
      <Pressable testID="log-impact" onPress={() => logImpact('Food bank drive', '£25')} />
    </>
  );
}

async function renderReady() {
  await render(
    <Providers>
      <TestHarness />
    </Providers>
  );
  await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('ready'));
}

test('loads a starting snapshot, then stops loading', async () => {
  await renderReady();
  expect(Number(screen.getByTestId('total').props.children)).toBe(6000);
});

test('transferFunds subtracts the amount from totalValue', async () => {
  await renderReady();
  await fireEvent.press(screen.getByTestId('transfer'));
  expect(Number(screen.getByTestId('total').props.children)).toBe(5900);
});

test('createAllocationRule adds a new vault', async () => {
  await renderReady();
  const before = Number(screen.getByTestId('vault-count').props.children);
  await fireEvent.press(screen.getByTestId('create-rule'));
  expect(Number(screen.getByTestId('vault-count').props.children)).toBe(before + 1);
});

test('deployCapital reduces unallocatedFunds, never below zero', async () => {
  await renderReady();
  await fireEvent.press(screen.getByTestId('deploy'));
  expect(Number(screen.getByTestId('unallocated').props.children)).toBe(550);
});

test('prunePayment removes one item from expenseAudit', async () => {
  await renderReady();
  const before = Number(screen.getByTestId('audit-count').props.children);
  await fireEvent.press(screen.getByTestId('prune'));
  expect(Number(screen.getByTestId('audit-count').props.children)).toBe(before - 1);
});

test('logImpact adds one entry to kingdomImpactLog', async () => {
  await renderReady();
  const before = Number(screen.getByTestId('impact-count').props.children);
  await fireEvent.press(screen.getByTestId('log-impact'));
  expect(Number(screen.getByTestId('impact-count').props.children)).toBe(before + 1);
});

test('useFinance throws when used outside a FinanceProvider', async () => {
  function Broken() {
    useFinance();
    return null;
  }

  await expect(render(<Broken />)).rejects.toThrow('useFinance must be used inside a FinanceProvider');
});
