import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentMethodsScreen() {
  const router = useRouter();

  const handleConnectCard = () => {
    Alert.alert(
      'Payment Methods',
      'Payment method management will be available soon. For now, payment methods are handled automatically during checkout.',
      [{ text: 'OK' }]
    );
  };

  const handleConnectBank = () => {
    Alert.alert(
      'Bank Account',
      'Bank account management for payouts will be available soon. Payouts are currently processed automatically.',
      [{ text: 'OK' }]
    );
  };

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
            <Text style={styles.headerTitle}>Payment Methods</Text>
          </View>
          <Text style={styles.headerSubtitle}>Manage your payment and payout methods</Text>
        </View>

        {/* Card for Payments */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sectionCardContent}>
            <View style={styles.sectionHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="card" size={24} color={Colors.text} />
              </View>
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionTitle}>Card for Payments</Text>
                <Text style={styles.sectionDescription}>
                  Add a card to make payments for transactions
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleConnectCard}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Connect Card</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              <Text style={styles.infoText}>
                Payment methods are handled securely through Stripe during checkout
              </Text>
            </View>
          </View>
        </View>

        {/* Bank Account for Payouts */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sectionCardContent}>
            <View style={styles.sectionHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="wallet" size={24} color={Colors.text} />
              </View>
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionTitle}>Bank Account for Payouts</Text>
                <Text style={styles.sectionDescription}>
                  Connect a bank account to receive payouts from completed transactions
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleConnectBank}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Connect Bank Account</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              <Text style={styles.infoText}>
                Payouts are processed automatically when transactions are completed
              </Text>
            </View>
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
  sectionCard: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.lg + 4,
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
  sectionCardShadow: {
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
  sectionCardContent: {
    padding: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: Spacing.md,
  },
  actionButtonText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});

