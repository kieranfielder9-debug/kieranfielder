import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Watchtower: undefined;
  Planning: undefined;
  Home: undefined;
  Allocation: undefined;
  Measurement: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Lock: undefined;
  Tabs: undefined;
  Transfer: undefined;
  NewAllocationRule: undefined;
  DeployCapital: undefined;
  PrunePayments: undefined;
  LogKingdomImpact: undefined;
};

// Modal screens live on the root stack, one level above the tab navigator.
// Any tab screen that needs to open one asks for the navigation prop typed
// this way — React Navigation bubbles `navigate()` up to a parent
// navigator automatically when the current one doesn't own that route.
export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
