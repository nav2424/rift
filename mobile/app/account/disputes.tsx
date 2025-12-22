import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export default function DisputesScreen() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    try {
      const data = await api.getUserDisputes();
      setDisputes(data);
    } catch (error: any) {
      console.error('Error loading disputes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDisputes();
  };

  const getStatusColor = (status: string) => {
    return status === 'OPEN' ? Colors.warning : Colors.success;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderDispute = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status);
    const rift = item.rift;

    return (
      <TouchableOpacity
        style={styles.disputeCard}
        onPress={() => router.push(`/rifts/${rift?.id}`)}
        activeOpacity={0.92}
      >
        <View style={styles.disputeCardShadow} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.disputeCardContent}>
          <View style={styles.disputeHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '25', borderColor: statusColor + '40' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.disputeDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {rift && (
            <>
              <Text style={styles.disputeTitle}>{rift.itemTitle}</Text>
              <Text style={styles.disputeReason}>{item.reason}</Text>
              <View style={styles.disputeFooter}>
                <Text style={styles.disputeAmount}>
                  {formatCurrency(rift.amount, rift.currency)}
                </Text>
                <Text style={styles.disputeRaisedBy}>
                  Raised by: {item.raisedBy?.name || item.raisedBy?.email || 'Unknown'}
                </Text>
              </View>
            </>
          )}

          {item.adminNote && (
            <View style={styles.adminNoteContainer}>
              <Text style={styles.adminNoteLabel}>Admin Note:</Text>
              <Text style={styles.adminNoteText}>{item.adminNote}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0C0C0C', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Disputes</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.loadingText}>Loading disputes...</Text>
        </View>
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

      <FlatList
        data={disputes}
        renderItem={renderDispute}
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
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Your Disputes</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {disputes.length === 0 
                ? 'No disputes found'
                : `${disputes.length} dispute${disputes.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No disputes</Text>
            <Text style={styles.emptyText}>
              You don't have any active or resolved disputes
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
  listContent: {
    paddingHorizontal: Spacing.xl + 4,
    paddingBottom: 120,
  },
  disputeCard: {
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
  disputeCardShadow: {
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
  disputeCardContent: {
    padding: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disputeDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  disputeTitle: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  disputeReason: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  disputeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  disputeAmount: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '700',
  },
  disputeRaisedBy: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  adminNoteContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  adminNoteLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminNoteText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: 15,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl + 12,
    paddingHorizontal: Spacing.xl + 4,
  },
  emptyTitle: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

