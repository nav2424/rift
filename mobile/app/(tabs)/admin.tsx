import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, RiftTransaction } from '@/lib/api';
import PremiumGlassCard from '@/components/PremiumGlassCard';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { Spacing, Typography, BorderRadius } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function AdminDashboardScreen() {
  const [rifts, setRifts] = useState<RiftTransaction[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Check if user is admin
    if (!user) {
      // Temporarily redirect to dashboard instead of signin
      router.replace('/(tabs)/dashboard');
      return;
    }

    if (user.role !== 'ADMIN') {
      Alert.alert('Access Denied', 'Admin access required');
      router.replace('/(tabs)/dashboard');
      setLoading(false);
      return;
    }

    // User is admin, load data
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading admin data...', { userId: user?.id, role: user?.role });
      const [riftsData, disputesData] = await Promise.all([
        api.getAdminEscrows(),
        api.getDisputes(),
      ]);
      console.log('Admin data loaded:', { rifts: riftsData.length, disputes: disputesData.length });
      setRifts(riftsData);
      setDisputes(disputesData);
    } catch (error: any) {
      console.error('Admin data load error:', error);
      if (error.message === 'Unauthorized' || error.message.includes('Unauthorized')) {
        Alert.alert('Access Denied', 'Admin access required');
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Error', error.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status: RiftTransaction['status']) => {
    switch (status) {
      case 'RELEASED':
        return Colors.success;
      case 'REFUNDED':
        return Colors.error;
      case 'DISPUTED':
        return Colors.warning;
      case 'CANCELLED':
        return '#9ca3af';
      default:
        return Colors.info;
    }
  };

  const renderEscrow = ({ item }: { item: RiftTransaction }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <PremiumGlassCard
        variant="premium"
        gradient
        onPress={() => router.push(`/rifts/${item.id}`)}
        style={styles.escrowCard}
      >
        <View style={styles.escrowHeader}>
          <View style={styles.escrowTitleContainer}>
            <Text style={styles.escrowTitle} numberOfLines={1}>
              {item.itemTitle}
            </Text>
            <Text style={styles.escrowType}>{item.itemType.replace(/_/g, ' ')}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColor + '25',
                borderColor: statusColor + '50',
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.escrowFooter}>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.escrowAmount}>
              {item.amount} {item.currency}
            </Text>
          </View>
          <View style={styles.partiesContainer}>
            <View style={styles.partyRow}>
              <Ionicons name="person-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.partyText}>Buyer: {item.buyer.name || item.buyer.email}</Text>
            </View>
            <View style={styles.partyRow}>
              <Ionicons name="storefront-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.partyText}>Seller: {item.seller.name || item.seller.email}</Text>
            </View>
          </View>
        </View>
      </PremiumGlassCard>
    );
  };

  const renderDispute = ({ item }: { item: any }) => {
    return (
      <PremiumGlassCard
        variant="premium"
        gradient
        onPress={() => router.push(`/rifts/${item.escrowId}`)}
        style={styles.disputeCard}
      >
        <View style={styles.disputeHeader}>
          <Ionicons name="warning-outline" size={24} color={Colors.warning} />
          <Text style={styles.disputeTitle}>Dispute</Text>
        </View>
        <Text style={styles.disputeReason} numberOfLines={2}>
          {item.reason}
        </Text>
        <Text style={styles.disputeRaisedBy}>
          Raised by: {item.raisedBy?.name || item.raisedBy?.email}
        </Text>
      </PremiumGlassCard>
    );
  };

  if (authLoading || loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Admin</Text>
            <Text style={styles.headerSubtitle}>Disputes and verification</Text>
          </View>
        </View>
      </BlurView>

      {/* Admin Stats Cards */}
      <View style={styles.statsContainer}>
        <PremiumGlassCard variant="default" style={styles.statCard}>
          <Ionicons name="warning" size={24} color={Colors.warning} />
          <Text style={styles.statValue}>{disputes.length}</Text>
          <Text style={styles.statLabel}>Open disputes</Text>
        </PremiumGlassCard>
        <PremiumGlassCard variant="default" style={styles.statCard}>
          <Ionicons name="time" size={24} color={Colors.info} />
          <Text style={styles.statValue}>{rifts.filter(e => e.status === 'AWAITING_PAYMENT' || e.status === 'AWAITING_SHIPMENT' || e.status === 'IN_TRANSIT').length}</Text>
          <Text style={styles.statLabel}>Pending verifications</Text>
        </PremiumGlassCard>
        <PremiumGlassCard variant="default" style={styles.statCard}>
          <Ionicons name="alert-circle" size={24} color={Colors.error} />
          <Text style={styles.statValue}>{rifts.filter(e => e.status === 'DISPUTED').length}</Text>
          <Text style={styles.statLabel}>High-risk transactions</Text>
        </PremiumGlassCard>
      </View>

      <FlatList
        data={disputes}
        renderItem={renderDispute}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Open Disputes</Text>
              <Text style={styles.sectionDescription}>
                Evidence-based dispute review for protected transactions.
              </Text>
            </View>
            {disputes.length === 0 && (
              <PremiumGlassCard variant="default" style={styles.emptyCard}>
                <Text style={styles.emptyText}>No open disputes</Text>
                <Text style={styles.emptySubtext}>
                  All protected transactions are proceeding smoothly.
                </Text>
              </PremiumGlassCard>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Escrows</Text>
              <Text style={styles.sectionDescription}>
                Track every step of protected deals, from payment to delivery.
              </Text>
            </View>
          </>
        }
        ListFooterComponent={
          <FlatList
            data={rifts}
            renderItem={renderEscrow}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    borderBottomWidth: 1, // Thin divider
    borderBottomColor: Colors.cardBorder, // 8% white
    paddingTop: Platform.OS === 'ios' ? 80 : Spacing.xxl + 8, // Increased top padding
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl, // 24px fixed
  },
  headerTitle: {
    ...Typography.title,
    color: Colors.text,
    marginBottom: Spacing.sm, // 8px between title & subtitle
  },
  headerSubtitle: {
    ...Typography.subtitle,
    color: Colors.textSecondary, // 70% opacity
  },
  list: {
    padding: Spacing.xl, // 24px fixed
    paddingTop: Spacing.lg, // 16px
  },
  sectionHeader: {
    marginTop: Spacing.xl, // 24px
    marginBottom: Spacing.lg, // 16px
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: Colors.text,
    marginBottom: Spacing.xs, // 4px
  },
  sectionDescription: {
    ...Typography.subsection,
    color: Colors.textTertiary, // 65% opacity
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl, // 24px
    paddingTop: Spacing.lg, // 16px
    gap: Spacing.md, // 12px
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg, // 16px
    alignItems: 'center',
  },
  statValue: {
    ...Typography.title,
    fontSize: 28,
    color: Colors.text,
    marginVertical: Spacing.sm, // 8px
  },
  statLabel: {
    ...Typography.subsection,
    color: Colors.textTertiary, // 65% opacity
    textAlign: 'center',
    fontSize: 11,
  },
  escrowCard: {
    padding: Spacing.xxl, // 32px
    marginBottom: Spacing.xl, // 24px between stacked cards
  },
  escrowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg, // 16px
  },
  escrowTitleContainer: {
    flex: 1,
    marginRight: Spacing.md, // 12px
  },
  escrowTitle: {
    ...Typography.sectionTitle,
    color: Colors.text,
    marginBottom: Spacing.xs, // 4px
  },
  escrowType: {
    ...Typography.subsection,
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md, // 12px
    paddingVertical: Spacing.sm, // 8px
    borderRadius: BorderRadius.input, // 16px
    borderWidth: 1, // Ultra-thin
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  escrowFooter: {
    paddingTop: Spacing.lg, // 16px
    borderTopWidth: 1, // Ultra-thin divider
    borderTopColor: Colors.cardBorder, // 8% white
  },
  amountContainer: {
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  escrowAmount: {
    ...Typography.title,
    fontSize: 28, // Slightly smaller for amounts
    color: Colors.text,
  },
  partiesContainer: {
    gap: 8,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
    marginLeft: 6,
  },
  disputeCard: {
    padding: 20,
    marginBottom: 16,
  },
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  disputeTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: Colors.text,
    marginLeft: 8,
  },
  disputeReason: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  disputeRaisedBy: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  emptyCard: {
    padding: Spacing.xxl, // 32px
    alignItems: 'center',
    marginBottom: Spacing.lg, // 16px
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs, // 4px
  },
  emptySubtext: {
    ...Typography.subsection,
    color: Colors.textTertiary, // 65% opacity
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.xxl, // 32px
  },
});

