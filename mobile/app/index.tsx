import { Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#000000', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#000000', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Don't redirect if we're already on an auth screen or tabs screen
  // This prevents redirect loops
  if (segments[0] === '(auth)' || segments[0] === '(tabs)') {
    return null;
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }
  
  return <Redirect href="/(auth)/signin" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
});

