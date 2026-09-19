import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../theme';
import { WatchtowerIcon, PlanningIcon, AllocationIcon, MeasurementIcon } from './icons';
import { HomeTabButton } from './HomeTabButton';
import { WatchtowerScreen } from '../screens/WatchtowerScreen';
import { PlanningScreen } from '../screens/PlanningScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AllocationScreen } from '../screens/AllocationScreen';
import { MeasurementScreen } from '../screens/MeasurementScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.neutral[800],
        tabBarInactiveTintColor: theme.colors.neutral[400],
        tabBarStyle: {
          backgroundColor: theme.colors.neutral[0],
          borderTopColor: theme.colors.neutral[100],
          height: 78,
          paddingTop: theme.spacing.sm,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Watchtower"
        component={WatchtowerScreen}
        options={{ tabBarIcon: ({ color, size }) => <WatchtowerIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Planning"
        component={PlanningScreen}
        options={{ tabBarIcon: ({ color, size }) => <PlanningIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarButton: HomeTabButton }}
      />
      <Tab.Screen
        name="Allocation"
        component={AllocationScreen}
        options={{ tabBarLabel: 'Alloc', tabBarIcon: ({ color, size }) => <AllocationIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Measurement"
        component={MeasurementScreen}
        options={{ tabBarLabel: 'Measure', tabBarIcon: ({ color, size }) => <MeasurementIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
