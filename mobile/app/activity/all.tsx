import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, TextInput, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, EscrowTransaction } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

type ActivityFilter = 'all' | 'active' | 'completed' | 'pending' | 'cancelled';

export default function AllActivityScreen() {
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ActivityFilter>('all');
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

  const getAllActivity = useMemo(() => {
    let filtered = [...escrows];

    // Apply status filter
    if (filter === 'active') {
      filtered = filtered.filter(e => 
        ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
      );
    } else if (filter === 'completed') {
      filtered = filtered.filter(e => e.status === 'RELEASED');
    } else if (filter === 'pending') {
      filtered = filtered.filter(e => {
        if (e.buyerId === user?.id) {
          return e.status === 'AWAITING_PAYMENT';
        } else {
          return e.status === 'AWAITING_SHIPMENT' || e.status === 'DELIVERED_PENDING_RELEASE';
        }
      });
    } else if (filter === 'cancelled') {
      filtered = filtered.filter(e => e.status === 'CANCELLED' || e.status === 'REFUNDED');
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(escrow => {
        const riftNumber = escrow.riftNumber?.toString() || escrow.id.slice(-4);
        const itemTitle = escrow.itemTitle?.toLowerCase() || '';
        const buyerName = (escrow.buyer.name || escrow.buyer.email || '').toLowerCase();
        const sellerName = (escrow.seller.name || escrow.seller.email || '').toLowerCase();
        
        return (
          riftNumber.includes(query) ||
          itemTitle.includes(query) ||
          buyerName.includes(query) ||
          sellerName.includes(query)
        );
      });
    }

    // Sort by date (most recent first)
    const sorted = filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Map to activity format
    return sorted.map(escrow => {
      const isBuyer = escrow.buyerId === user?.id;
      const otherParty = isBuyer ? escrow.seller : escrow.buyer;
      const name = otherParty.name || otherParty.email.split('@')[0];

      const riftNumber = escrow.riftNumber ?? escrow.id.slice(-4);
      let message = '';
      switch (escrow.status) {
        case 'AWAITING_PAYMENT':
          message = isBuyer 
            ? `Rift #${riftNumber} — You created a rift with ${name} — awaiting payment`
            : `Rift #${riftNumber} — ${name} created a rift — awaiting payment`;
          break;
        case 'AWAITING_SHIPMENT':
          message = isBuyer
            ? `Rift #${riftNumber} — Payment received — awaiting shipment`
            : `Rift #${riftNumber} — Payment received — upload proof of shipment`;
          break;
        case 'IN_TRANSIT':
          message = `Rift #${riftNumber} — Shipment in transit`;
          break;
        case 'DELIVERED_PENDING_RELEASE':
          message = isBuyer
            ? `Rift #${riftNumber} — Shipment delivered — waiting for your confirmation`
            : `Rift #${riftNumber} — Shipment delivered — waiting for buyer confirmation`;
          break;
        case 'RELEASED':
          message = `Rift #${riftNumber} — Funds released — transaction completed`;
          break;
        case 'REFUNDED':
          message = `Rift #${riftNumber} — Transaction refunded`;
          break;
        case 'DISPUTED':
          message = `Rift #${riftNumber} — Transaction disputed`;
          break;
        case 'CANCELLED':
          message = `Rift #${riftNumber} — Transaction cancelled`;
          break;
        default:
          message = `Rift #${riftNumber} — ${escrow.status.replace(/_/g, ' ').toLowerCase()}`;
      }

      return { ...escrow, message, name };
    });
  }, [escrows, user?.id, filter, searchQuery]);

  const getActivityIcon = (message: string) => {
    if (message.includes('completed') || message.includes('released')) {
      return 'checkmark-circle';
    }
    if (message.includes('transit')) {
      return 'cube';
    }
    if (message.includes('payment')) {
      return 'card';
    }
    if (message.includes('cancelled') || message.includes('refunded')) {
      return 'close';
    }
    if (message.includes('disputed')) {
      return 'warning';
    }
    return 'ellipse';
  };

  const getActivityColor = (message: string) => {
    if (message.includes('completed') || message.includes('released')) {
      return Colors.success;
    }
    if (message.includes('transit')) {
      return Colors.info;
    }
    if (message.includes('cancelled') || message.includes('refunded')) {
      return Colors.error;
    }
    if (message.includes('disputed')) {
      return Colors.warning;
    }
    return Colors.textTertiary;
  };

  const renderActivity = ({ item }: { item: EscrowTransaction & { message: string; name: string } }) => {
    const icon = getActivityIcon(item.message);
    const color = getActivityColor(item.message);

    return (
      <TouchableOpacity
        style={styles.activityItem}
        onPress={() => router.push(`/escrows/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.activityIcon, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={14} color={color} />
        </View>
        <Text style={styles.activityText}>{item.message}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={styles.activityChevron} />
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
        <View style={styles.loadingContainer}>
          <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.loadingText}>Loading activities...</Text>
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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>All Activity</Text>
            <Text style={styles.headerSubtitle}>
              {getAllActivity.length} {getAllActivity.length === 1 ? 'activity' : 'activities'}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by rift #, item name, or buyer/seller..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {(['all', 'active', 'pending', 'completed', 'cancelled'] as ActivityFilter[]).map((filterType) => (
              <TouchableOpacity
                key={filterType}
                style={[styles.filterButton, filter === filterType && styles.filterButtonActive]}
                onPress={() => setFilter(filterType)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, filter === filterType && styles.filterButtonTextActive]}>
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Activity List */}
      <FlatList
        data={getAllActivity}
        renderItem={renderActivity}
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
            <Ionicons 
              name={searchQuery || filter !== 'all' ? "search-outline" : "time-outline"} 
              size={56} 
              color={Colors.textTertiary} 
            />
            <Text style={styles.emptyTitle}>
              {searchQuery || filter !== 'all' 
                ? 'No activities found' 
                : 'No activity yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Your transaction activity will appear here'}
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
    fontWeight: '300',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 80 : Spacing.xxl + 8,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl + 4,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.8,
  },
  listContent: {
    paddingHorizontal: Spacing.xl + 4,
    paddingBottom: 120,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 12,
    marginBottom: Spacing.xs,
  },
  activityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    fontWeight: '400',
    opacity: 0.85,
  },
  activityChevron: {
    opacity: 0.5,
  },
  emptyContainer: {
    paddingVertical: Spacing.xxl + 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: '300',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    opacity: 0.8,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl + 4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchIcon: {
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400',
    paddingVertical: 0,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  filterContainer: {
    paddingHorizontal: Spacing.xl + 4,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl + 4,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  filterButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  filterButtonTextActive: {
    color: Colors.primary,
    fontWeight: '500',
  },
});

