import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSecurity } from '../state/SecurityContext';
import { SplashScreen } from '../components/SplashScreen';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LockScreen } from '../screens/auth/LockScreen';
import { TransferModal } from '../screens/modals/TransferModal';
import { NewAllocationRuleModal } from '../screens/modals/NewAllocationRuleModal';
import { DeployCapitalModal } from '../screens/modals/DeployCapitalModal';
import { PrunePaymentsModal } from '../screens/modals/PrunePaymentsModal';
import { LogKingdomImpactModal } from '../screens/modals/LogKingdomImpactModal';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isHydrated, hasCompletedOnboarding, isAppLocked } = useSecurity();

  // Wait for the saved settings to load before deciding which screen to
  // show — otherwise a returning user would flash Onboarding for one
  // frame before flipping to Tabs the moment hydration finishes.
  if (!isHydrated) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : isAppLocked ? (
        <Stack.Screen name="Lock" component={LockScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen name="Transfer" component={TransferModal} />
            <Stack.Screen name="NewAllocationRule" component={NewAllocationRuleModal} />
            <Stack.Screen name="DeployCapital" component={DeployCapitalModal} />
            <Stack.Screen name="PrunePayments" component={PrunePaymentsModal} />
            <Stack.Screen name="LogKingdomImpact" component={LogKingdomImpactModal} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
}
