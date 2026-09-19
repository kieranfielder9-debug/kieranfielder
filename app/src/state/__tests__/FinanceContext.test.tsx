import { ReactNode } from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastProvider } from '../ToastContext';
import { FinanceProvider, useFinance } from '../FinanceContext';
import { api } from '../../services/api';

jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

const BASE_SNAPSHOT = {
  isLoading: false,
  totalValue: 6000,
  healthScore: 85,
  unallocatedFunds: 600,
  harvestMode: 'Standard',
  investmentMode: 'Standard',
  vaults: [{ id: 'emergency-fund', name: 'Emergency Fund', splitLabel: '10% Auto-Split', balance: 1800 }],
  recentActivity: [],
  expenseAudit: [{ id: 'streaming', label: 'Streaming Subscription', amountLabel: '£9.99/mo' }],
  kingdomImpactLog: [],
  assessments: [],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockedApi.getFinance.mockResolvedValue(BASE_SNAPSHOT);
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FinanceProvider>{children}</FinanceProvider>
    </ToastProvider>
  );
}

function TestHarness() {
  const { isLoading, isOffline, totalValue, transferFunds, prunePayment } = useFinance();

  return (
    <>
      <Text testID="loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="offline">{isOffline ? 'offline' : 'online'}</Text>
      <Text testID="total">{totalValue}</Text>
      <Pressable testID="transfer" onPress={() => transferFunds(100, 'Emergency Fund')} />
      <Pressable testID="prune" onPress={() => prunePayment('streaming')} />
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

test('loads the snapshot from the server on mount', async () => {
  await renderReady();
  expect(mockedApi.getFinance).toHaveBeenCalledTimes(1);
  expect(Number(screen.getByTestId('total').props.children)).toBe(6000);
  expect(screen.getByTestId('offline').props.children).toBe('online');
});

test('falls back to offline mode when the server is unreachable, with no cache to show', async () => {
  mockedApi.getFinance.mockRejectedValue(new Error('network error'));
  await renderReady();
  expect(screen.getByTestId('offline').props.children).toBe('offline');
});

test('transferFunds calls the API and applies whatever it returns', async () => {
  await renderReady();
  mockedApi.transfer.mockResolvedValue({ ...BASE_SNAPSHOT, totalValue: 5900 });

  await fireEvent.press(screen.getByTestId('transfer'));

  expect(mockedApi.transfer).toHaveBeenCalledWith(100, 'Emergency Fund');
  await waitFor(() => expect(Number(screen.getByTestId('total').props.children)).toBe(5900));
});

test('a cached snapshot renders immediately, before the network call resolves', async () => {
  await AsyncStorage.setItem('storehouse.finance-data', JSON.stringify({ ...BASE_SNAPSHOT, totalValue: 4000 }));

  let resolveFetch: (value: typeof BASE_SNAPSHOT) => void = () => {};
  mockedApi.getFinance.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));

  await render(
    <Providers>
      <TestHarness />
    </Providers>
  );

  await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('ready'));
  expect(Number(screen.getByTestId('total').props.children)).toBe(4000);

  resolveFetch(BASE_SNAPSHOT);
  await waitFor(() => expect(Number(screen.getByTestId('total').props.children)).toBe(6000));
});

test('prunePayment surfaces an error toast without crashing when the API rejects', async () => {
  await renderReady();
  mockedApi.prunePayment.mockRejectedValue(new Error('no such expense audit item'));

  await fireEvent.press(screen.getByTestId('prune'));

  expect(mockedApi.prunePayment).toHaveBeenCalledWith('streaming');
  // totalValue is untouched — a failed action must not silently corrupt
  // what's already on screen.
  expect(Number(screen.getByTestId('total').props.children)).toBe(6000);
});

test('useFinance throws when used outside a FinanceProvider', async () => {
  function Broken() {
    useFinance();
    return null;
  }

  await expect(render(<Broken />)).rejects.toThrow('useFinance must be used inside a FinanceProvider');
});
