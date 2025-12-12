import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/lib/api';
import { useState } from 'react';

export default function DebugScreen() {
  const [status, setStatus] = useState<string>('Checking...');
  const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

  const testConnection = async () => {
    try {
      setStatus('Testing API connection...');
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        method: 'GET',
      });
      setStatus(`Status: ${response.status} - ${response.statusText}`);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Debug Info</Text>
        
        <View style={styles.section}>
          <Text style={styles.label}>API URL:</Text>
          <Text style={styles.value}>{apiUrl}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{status}</Text>
        </View>

        <Text style={styles.button} onPress={testConnection}>
          Test Connection
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: 16,
    borderRadius: 8,
    textAlign: 'center',
    marginTop: 20,
  },
});

