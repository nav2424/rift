import { Stack } from 'expo-router';

export default function EscrowsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // We'll use custom headers in the components
      }}
    >
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

