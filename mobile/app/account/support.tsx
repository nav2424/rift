import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Linking, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export default function SupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params.type as string || 'faq';
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');

  const handleSendMessage = () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    if (type === 'contact' && !subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }

    // In a real app, this would send to a backend
    Alert.alert(
      'Message Sent',
      'Thank you for contacting us. We\'ll get back to you soon.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const faqItems = [
    {
      question: 'How does RIFT protect my transactions?',
      answer: 'RIFT holds funds in rift until both parties confirm the transaction is complete. This ensures buyers receive what they paid for and sellers get paid.',
    },
    {
      question: 'How long does it take to receive funds?',
      answer: 'Once the buyer confirms receipt, funds are typically released within 1-2 business days.',
    },
    {
      question: 'What if there\'s a dispute?',
      answer: 'You can raise a dispute from any transaction. Our team will review the case and make a fair decision based on evidence provided.',
    },
    {
      question: 'Are there any fees?',
      answer: 'RIFT charges a small platform fee on completed transactions. This fee is clearly displayed before you confirm payment.',
    },
    {
      question: 'How do I track my shipment?',
      answer: 'Sellers can upload tracking information when shipping. You\'ll receive updates as the package moves through transit.',
    },
  ];

  if (type === 'faq') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0C0C0C', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
            </View>
            <Text style={styles.headerSubtitle}>Find answers to common questions</Text>
          </View>

          {faqItems.map((item, index) => (
            <View key={index} style={styles.faqCard}>
              <View style={styles.faqCardShadow} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.faqCardContent}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0C0C0C', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {type === 'contact' ? 'Contact Support' : 'Report a Problem'}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {type === 'contact' 
              ? 'Get help from our support team'
              : 'Let us know about any issues you\'re experiencing'}
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formCardShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.formCardContent}>
            {type === 'contact' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="What is this regarding?"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder={type === 'contact' ? 'Describe your issue...' : 'What problem are you experiencing?'}
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 80 : Spacing.xxl + 8,
    paddingHorizontal: Spacing.xl + 4,
    paddingBottom: Spacing.xl + 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg + 2,
    marginBottom: Spacing.xs + 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 32,
    color: Colors.text,
    fontWeight: '500',
    letterSpacing: -0.5,
    lineHeight: 40,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.65,
    lineHeight: 22,
  },
  faqCard: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.md + 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  faqCardShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  faqCardContent: {
    padding: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  faqQuestion: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  formCard: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.xl + 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  formCardShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  formCardContent: {
    padding: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: Spacing.lg,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400',
  },
  textArea: {
    minHeight: 120,
    paddingTop: Spacing.lg,
  },
  sendButton: {
    paddingVertical: Spacing.lg + 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  sendButtonText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

