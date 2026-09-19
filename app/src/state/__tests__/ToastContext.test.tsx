import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ToastProvider, useToast } from '../ToastContext';

function TestHarness() {
  const { toast, showToast, hideToast } = useToast();
  return (
    <>
      <Text testID="message">{toast?.message ?? 'none'}</Text>
      <Pressable testID="show" onPress={() => showToast('Saved', 'success')} />
      <Pressable testID="hide" onPress={hideToast} />
    </>
  );
}

test('showToast displays the message, hideToast clears it immediately', async () => {
  await render(
    <ToastProvider>
      <TestHarness />
    </ToastProvider>
  );

  expect(screen.getByTestId('message').props.children).toBe('none');

  await fireEvent.press(screen.getByTestId('show'));
  expect(screen.getByTestId('message').props.children).toBe('Saved');

  await fireEvent.press(screen.getByTestId('hide'));
  expect(screen.getByTestId('message').props.children).toBe('none');
});

test('a toast clears itself automatically after 3 seconds', async () => {
  jest.useFakeTimers();

  await render(
    <ToastProvider>
      <TestHarness />
    </ToastProvider>
  );

  await fireEvent.press(screen.getByTestId('show'));
  expect(screen.getByTestId('message').props.children).toBe('Saved');

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByTestId('message').props.children).toBe('none');

  jest.useRealTimers();
});

test('useToast throws when used outside a ToastProvider', async () => {
  function Broken() {
    useToast();
    return null;
  }

  await expect(render(<Broken />)).rejects.toThrow('useToast must be used inside a ToastProvider');
});
