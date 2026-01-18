import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing, Typography, BorderRadius } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Rift! 👋',
      description: 'Rift is your secure payment platform for marketplace transactions. Let\'s take a quick tour to get you started.',
      icon: 'rocket',
    },
    {
      id: 'dashboard',
      title: 'Your Dashboard',
      description: 'This is your dashboard where you can see all your active and completed transactions (Rifts). Track payments, shipments, and releases all in one place.',
      icon: 'home',
    },
    {
      id: 'create-rift',
      title: 'Create a Rift',
      description: 'Tap the Create tab to set up a new Rift transaction. You can create protected payments for any marketplace sale.',
      icon: 'add-circle',
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Communicate securely with buyers and sellers directly through Rift. All messages are tied to your transactions.',
      icon: 'chatbubbles',
    },
    {
      id: 'account',
      title: 'Your Account',
      description: 'Manage your profile, view your Rift ID, check your balance, and update settings from your account page.',
      icon: 'person',
    },
    {
      id: 'complete',
      title: "You're all set! 🎉",
      description: 'You now know the basics of Rift. Start by creating your first Rift transaction or explore the platform. Need help? Check out our FAQ or contact support.',
      icon: 'checkmark-circle',
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/me/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Don't wait for response - complete anyway
    } catch (error) {
      console.error('Error marking onboarding as complete:', error);
    }
    onComplete();
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.98)']}
          style={StyleSheet.absoluteFill}
        />
        
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard variant="liquid" style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={currentStepData.icon as any} 
                  size={48} 
                  color={Colors.primary} 
                />
              </View>
              <Text style={styles.stepIndicator}>
                {currentStep + 1} / {steps.length}
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>{currentStepData.title}</Text>
              <Text style={styles.description}>{currentStepData.description}</Text>
            </View>

            <View style={styles.actions}>
              <GlassButton
                title={currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                onPress={handleNext}
                variant="primary"
                size="lg"
                style={styles.button}
              />
              {currentStep < steps.length - 1 && (
                <TouchableOpacity
                  onPress={handleSkip}
                  style={styles.skipButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Progress dots */}
            <View style={styles.progressContainer}>
              {steps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentStep && styles.progressDotActive,
                    index < currentStep && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    </Modal>
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
  },
  card: {
    padding: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  stepIndicator: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  content: {
    marginBottom: Spacing.xxl,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    marginBottom: Spacing.lg,
  },
  button: {
    marginBottom: Spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});

