import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import PremiumGlassCard from '@/components/PremiumGlassCard';
import GlassButton from '@/components/GlassButton';
import RiftLogo from '@/components/RiftLogo';
import { Colors } from '@/constants/Colors';
import { Spacing, Typography, BorderRadius } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const isSubmitting = useRef(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (loading || isSubmitting.current) {
      return; // Prevent multiple calls
    }

    isSubmitting.current = true;
    setLoading(true);
    
    try {
      await signIn(email, password);
      // Navigate immediately after successful sign in
      setLoading(false);
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage = error.message || 'Failed to sign in';
      Alert.alert(
        'Sign In Failed', 
        errorMessage,
        [
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#000000', '#000000', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <RiftLogo size={80} />
            <Text style={styles.tagline}>Secure rift for marketplace deals.</Text>
          </View>

          <PremiumGlassCard variant="premium" style={styles.formCard}>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                </View>
              </View>

              <GlassButton
                title={loading ? 'Signing In...' : 'Sign In'}
                onPress={handleSignIn}
                variant="primary"
                size="lg"
                disabled={loading}
                loading={loading}
                style={styles.button}
              />

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push('/(auth)/signup')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>
                  Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </PremiumGlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  content: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  tagline: {
    ...Typography.subtitle,
    textAlign: 'center',
    marginTop: Spacing.md,
    color: Colors.textSecondary,
  },
  formCard: {
    padding: Spacing.xxl,
    marginHorizontal: 0,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    ...Typography.sectionTitle,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.xl,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: Spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.lg,
    color: Colors.text,
    ...Typography.body,
  },
  button: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  linkButton: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  linkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  linkTextBold: {
    ...Typography.button,
    color: Colors.text,
  },
});
