import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecurityProvider, useSecurity } from '../SecurityContext';
import { ToastProvider } from '../ToastContext';
import { api } from '../../services/api';

jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

const DEFAULT_SETTINGS = {
  isFaceIdSetUp: false,
  stepUpThreshold: 500,
  shouldBalancesBlur: false,
  hasCompletedOnboarding: false,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockedApi.getSecurity.mockResolvedValue(DEFAULT_SETTINGS);
  mockedApi.patchSecurity.mockImplementation(async (patch) => ({ ...DEFAULT_SETTINGS, ...patch }));
});

function TestHarness() {
  const { isAppLocked, shouldBalancesBlur, hasCompletedOnboarding, lockApp, unlockApp, toggleBalanceBlur, completeOnboarding } =
    useSecurity();
  return (
    <>
      <Text testID="locked">{isAppLocked ? 'locked' : 'unlocked'}</Text>
      <Text testID="blurred">{shouldBalancesBlur ? 'blurred' : 'visible'}</Text>
      <Text testID="onboarded">{hasCompletedOnboarding ? 'done' : 'pending'}</Text>
      <Pressable testID="lock" onPress={lockApp} />
      <Pressable testID="unlock" onPress={unlockApp} />
      <Pressable testID="toggle-blur" onPress={toggleBalanceBlur} />
      <Pressable testID="complete-onboarding" onPress={completeOnboarding} />
    </>
  );
}

async function renderHydrated() {
  return render(
    <ToastProvider>
      <SecurityProvider>
        <TestHarness />
      </SecurityProvider>
    </ToastProvider>
  );
}

test('starts unlocked, with balances visible and onboarding not complete', async () => {
  await renderHydrated();
  await waitFor(() => expect(mockedApi.getSecurity).toHaveBeenCalled());
  expect(screen.getByTestId('locked').props.children).toBe('unlocked');
  expect(screen.getByTestId('blurred').props.children).toBe('visible');
  expect(screen.getByTestId('onboarded').props.children).toBe('pending');
});

test('lockApp and unlockApp are purely local — never call the API', async () => {
  await renderHydrated();
  await waitFor(() => expect(mockedApi.getSecurity).toHaveBeenCalled());

  await fireEvent.press(screen.getByTestId('lock'));
  expect(screen.getByTestId('locked').props.children).toBe('locked');

  await fireEvent.press(screen.getByTestId('unlock'));
  expect(screen.getByTestId('locked').props.children).toBe('unlocked');

  expect(mockedApi.patchSecurity).not.toHaveBeenCalled();
});

test('toggleBalanceBlur updates immediately, then confirms with the server', async () => {
  await renderHydrated();
  await waitFor(() => expect(mockedApi.getSecurity).toHaveBeenCalled());

  await fireEvent.press(screen.getByTestId('toggle-blur'));

  expect(screen.getByTestId('blurred').props.children).toBe('blurred');
  await waitFor(() => expect(mockedApi.patchSecurity).toHaveBeenCalledWith({ shouldBalancesBlur: true }));
});

test('falls back to defaults and still finishes loading when the server is unreachable', async () => {
  mockedApi.getSecurity.mockRejectedValue(new Error('network error'));
  await renderHydrated();
  await waitFor(() => expect(screen.getByTestId('onboarded').props.children).toBe('pending'));
});

test('settings persist across a remount via the local cache', async () => {
  const { unmount } = await renderHydrated();
  await waitFor(() => expect(mockedApi.getSecurity).toHaveBeenCalled());

  mockedApi.patchSecurity.mockResolvedValue({ ...DEFAULT_SETTINGS, hasCompletedOnboarding: true });
  await fireEvent.press(screen.getByTestId('complete-onboarding'));
  await waitFor(() => expect(screen.getByTestId('onboarded').props.children).toBe('done'));

  await unmount();

  // Simulate a restart where the server is briefly unreachable — the
  // cached value from the first render should still show immediately.
  mockedApi.getSecurity.mockRejectedValue(new Error('network error'));
  await render(
    <ToastProvider>
      <SecurityProvider>
        <TestHarness />
      </SecurityProvider>
    </ToastProvider>
  );
  await waitFor(() => expect(screen.getByTestId('onboarded').props.children).toBe('done'));
});

test('useSecurity throws when used outside a SecurityProvider', async () => {
  function Broken() {
    useSecurity();
    return null;
  }

  await expect(render(<Broken />)).rejects.toThrow('useSecurity must be used inside a SecurityProvider');
});
