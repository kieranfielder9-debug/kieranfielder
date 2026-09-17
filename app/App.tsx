import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from './src/theme';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>£6,000</Text>
      <Text style={styles.label}>Theme tokens wired up</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  heading: {
    ...theme.text.t1,
    color: theme.colors.neutral[800],
  },
  label: {
    ...theme.text.t3,
    color: theme.colors.neutral[400],
  },
});
