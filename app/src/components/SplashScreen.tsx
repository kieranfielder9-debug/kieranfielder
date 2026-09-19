import { View, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Meta } from './primitives';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Meta>Loading Storehouse…</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[0], alignItems: 'center', justifyContent: 'center' },
});
