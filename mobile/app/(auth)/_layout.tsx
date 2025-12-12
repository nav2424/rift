import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
        } as any,
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '300',
        },
      }}
    >
      <Stack.Screen name="signin" options={{ title: '' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
    </Stack>
  );
}

