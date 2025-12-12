import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import RiftLogo from '@/components/RiftLogo';
import { Colors } from '@/constants/Colors';
import { Spacing, Typography, BorderRadius } from '@/constants/DesignSystem';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(name, email, password);
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
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
            <RiftLogo size={120} />
            <Text style={styles.subtitle}>Create Account</Text>
          </View>

          <GlassCard variant="liquid" style={styles.formCard}>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <GlassButton
                title={loading ? 'Creating Account...' : 'Sign Up'}
                onPress={handleSignUp}
                variant="primary"
                size="lg"
                disabled={loading}
                loading={loading}
                style={styles.button}
              />

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>
                  Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
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
    padding: Spacing.xl, // 24px fixed
    paddingTop: Spacing.xxxl, // 48px
  },
  content: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl, // 32px
    paddingTop: Spacing.lg, // 16px upward
  },
  subtitle: {
    ...Typography.subtitle,
    textAlign: 'center',
    marginTop: Spacing.sm, // 8px between logo and tagline
  },
  formCard: {
    padding: Spacing.xxl, // 32px
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: Spacing.xl, // 24px
  },
  inputLabel: {
    ...Typography.sectionTitle,
    color: Colors.text,
    marginBottom: Spacing.md, // 12px
  },
  input: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1, // Ultra-thin
    borderColor: Colors.cardBorder, // 8% white
    borderRadius: BorderRadius.input, // 16px
    padding: Spacing.lg, // 16px
    color: Colors.text,
    ...Typography.body,
    minHeight: 56,
  },
  button: {
    marginTop: Spacing.xl, // 24px
    marginBottom: Spacing.xl, // 24px
  },
  linkButton: {
    marginTop: Spacing.xxl, // 32px
    alignItems: 'center',
    paddingVertical: Spacing.sm, // 8px
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

