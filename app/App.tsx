import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { SecurityProvider } from './src/state/SecurityContext';
import { ToastProvider } from './src/state/ToastContext';
import { FinanceProvider } from './src/state/FinanceContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastBanner } from './src/components/ToastBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SecurityProvider>
          <FinanceProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </FinanceProvider>
        </SecurityProvider>
        <ToastBanner />
      </ToastProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
