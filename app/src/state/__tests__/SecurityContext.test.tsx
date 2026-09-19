import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecurityProvider, useSecurity } from '../SecurityContext';

// Each test gets a clean slate — AsyncStorage's mock is in-memory and
// shared across every test in this file, so a setting saved by one test
// would otherwise leak into the next one's "starts with defaults" checks.
beforeEach(async () => {
  await AsyncStorage.clear();
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
  const result = await render(
    <SecurityProvider>
      <TestHarness />
    </SecurityProvider>
  );
  // isHydrated flips true only after the AsyncStorage read resolves, so
  // every test waits for that before pressing anything.
  await waitFor(() => expect(screen.getByTestId('locked')).toBeTruthy());
  return result;
}

test('starts unlocked, with balances visible and onboarding not complete', async () => {
  await renderHydrated();
  expect(screen.getByTestId('locked').props.children).toBe('unlocked');
  expect(screen.getByTestId('blurred').props.children).toBe('visible');
  expect(screen.getByTestId('onboarded').props.children).toBe('pending');
});

test('lockApp and unlockApp flip isAppLocked', async () => {
  await renderHydrated();

  await fireEvent.press(screen.getByTestId('lock'));
  expect(screen.getByTestId('locked').props.children).toBe('locked');

  await fireEvent.press(screen.getByTestId('unlock'));
  expect(screen.getByTestId('locked').props.children).toBe('unlocked');
});

test('toggleBalanceBlur flips shouldBalancesBlur', async () => {
  await renderHydrated();

  await fireEvent.press(screen.getByTestId('toggle-blur'));
  expect(screen.getByTestId('blurred').props.children).toBe('blurred');

  await fireEvent.press(screen.getByTestId('toggle-blur'));
  expect(screen.getByTestId('blurred').props.children).toBe('visible');
});

test('settings persist across a remount, simulating an app restart', async () => {
  const { unmount } = await renderHydrated();

  await fireEvent.press(screen.getByTestId('complete-onboarding'));
  await waitFor(() => expect(screen.getByTestId('onboarded').props.children).toBe('done'));

  await unmount();

  await render(
    <SecurityProvider>
      <TestHarness />
    </SecurityProvider>
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
