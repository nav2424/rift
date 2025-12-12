import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, EscrowTransaction } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export default function AllRiftsScreen() {
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const { user } = useAuth();
  const router = useRouter();

  const loadEscrows = useCallback(async () => {
    try {
      const data = await api.getEscrows();
      setEscrows(data);
    } catch (error: any) {
      // Silently handle errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEscrows();
  }, [loadEscrows]);

  useFocusEffect(
    useCallback(() => {
      loadEscrows();
    }, [loadEscrows])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadEscrows();
  };

  const filteredEscrows = escrows.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status);
    }
    if (filter === 'completed') {
      return e.status === 'RELEASED';
    }
    if (filter === 'cancelled') {
      return e.status === 'CANCELLED';
    }
    return true;
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: EscrowTransaction['status']) => {
    switch (status) {
      case 'RELEASED': return '#10b981';
      case 'REFUNDED': return '#ef4444';
      case 'DISPUTED': return '#f59e0b';
      case 'CANCELLED': return '#6b7280';
      case 'AWAITING_PAYMENT': return '#3b82f6';
      case 'AWAITING_SHIPMENT': return '#8b5cf6';
      case 'IN_TRANSIT': return '#06b6d4';
      case 'DELIVERED_PENDING_RELEASE': return '#14b8a6';
      default: return '#60a5fa';
    }
  };

  const getStatusIcon = (status: EscrowTransaction['status']) => {
    switch (status) {
      case 'RELEASED': return 'checkmark-circle';
      case 'REFUNDED': return 'arrow-back-circle';
      case 'DISPUTED': return 'warning';
      case 'CANCELLED': return 'close';
      case 'AWAITING_PAYMENT': return 'card';
      case 'AWAITING_SHIPMENT': return 'cube';
      case 'IN_TRANSIT': return 'cube';
      case 'DELIVERED_PENDING_RELEASE': return 'checkmark-done';
      default: return 'time';
    }
  };

  const renderEscrow = ({ item }: { item: EscrowTransaction }) => {
    const isBuyer = item.buyerId === user?.id;
    const role = isBuyer ? 'Buyer' : 'Seller';
    const otherParty = isBuyer ? item.seller : item.buyer;
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push(`/escrows/${item.id}`)}
        style={styles.escrowCard}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.escrowCardInner}>
          <View style={styles.escrowTopRow}>
            <View style={styles.escrowTitleRow}>
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
              <View style={styles.escrowTitleSection}>
                <Text style={styles.escrowTitle} numberOfLines={1}>
                  Rift #{item.riftNumber} — {item.status.replace(/_/g, ' ')}
                </Text>
                <View style={styles.escrowMetaRow}>
                  <Text style={styles.escrowType}>{item.itemType.replace(/_/g, ' ')}</Text>
                  <Text style={styles.escrowDot}>•</Text>
                  <Text style={styles.escrowRole}>{role}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
              <Ionicons name={statusIcon as any} size={12} color={statusColor} />
            </View>
          </View>

          <View style={styles.escrowBottomRow}>
            <View style={styles.amountSection}>
              <Text style={styles.amountValue}>{formatCurrency(item.amount, item.currency)}</Text>
              <Text style={styles.otherParty}>{otherParty.name || otherParty.email.split('@')[0]}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#000000', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#000000', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Rifts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
          onPress={() => setFilter('active')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterButtonText, filter === 'active' && styles.filterButtonTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterButtonText, filter === 'completed' && styles.filterButtonTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
          onPress={() => setFilter('cancelled')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterButtonText, filter === 'cancelled' && styles.filterButtonTextActive]}>
            Cancelled
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredEscrows}
        renderItem={renderEscrow}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No rifts found</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' 
                ? 'You don\'t have any rifts yet'
                : `You don't have any ${filter} rifts`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : Spacing.xl,
    paddingHorizontal: Spacing.xl + 4,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    fontSize: 24,
    color: Colors.text,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerSpacer: {
    width: 40,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl + 4,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  filterButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md + 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  filterButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 120,
  },
  escrowCard: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.md + 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  escrowCardInner: {
    padding: Spacing.lg + 4,
  },
  escrowTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  escrowTitleRow: {
    flexDirection: 'row',
    flex: 1,
    gap: Spacing.sm,
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginTop: 2,
  },
  escrowTitleSection: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  escrowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  escrowType: {
    fontSize: 13,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  escrowDot: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  escrowRole: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  escrowBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  amountSection: {
    flex: 1,
  },
  amountValue: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  otherParty: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: Spacing.xxl + 12,
    paddingHorizontal: Spacing.xl + 4,
    alignItems: 'center',
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
});

