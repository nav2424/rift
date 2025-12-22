import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Platform, ScrollView, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, RiftTransaction } from '@/lib/api';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToUserEscrows } from '@/lib/realtime-rifts';

type TimeFilter = 'all' | '30days' | 'month';

export default function DashboardScreen() {
  const [rifts, setRifts] = useState<RiftTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [scrollY] = useState(new Animated.Value(0));
  const { user } = useAuth();
  const router = useRouter();

  const loadEscrows = useCallback(async () => {
    try {
      const data = await api.getEscrows();
      setRifts(data);
    } catch (error: any) {
      // Silently handle errors - don't show alerts or log
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEscrows();
  }, [loadEscrows]);

  // Reload rifts when screen comes into focus (instant updates after actions)
  useFocusEffect(
    useCallback(() => {
      loadEscrows();
    }, [loadEscrows])
  );

  // Real-time sync for rifts
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToUserEscrows(
      user.id,
      (update) => {
        // Update existing rift or add new one
        setRifts((prev) => {
          const existingIndex = prev.findIndex((e) => e.id === update.id);
          if (existingIndex >= 0) {
            // Update existing rift
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...update };
            return updated;
          } else {
            // New rift - reload to get full data
            loadEscrows();
            return prev;
          }
        });
      },
      (newEscrow) => {
        // New rift created - reload to get full data with relations
        loadEscrows();
      },
      (error) => {
        console.error('Realtime rift sync error:', error);
        // Silently fail - don't disrupt user experience
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id, loadEscrows]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEscrows();
  };

  const filteredEscrows = useMemo(() => {
    if (timeFilter === 'all') return rifts;
    
    const now = new Date();
    const filterDate = new Date();
    
    if (timeFilter === '30days') {
      filterDate.setDate(now.getDate() - 30);
    } else if (timeFilter === 'month') {
      filterDate.setMonth(now.getMonth() - 1);
    }
    
    return rifts.filter(e => new Date(e.createdAt) >= filterDate);
  }, [rifts, timeFilter]);

  const metrics = useMemo(() => {
    // Exclude cancelled rifts from all metrics
    const validEscrows = filteredEscrows.filter(e => e.status !== 'CANCELLED');
    
    const active = validEscrows.filter(e => 
      ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
    );
    const completed = validEscrows.filter(e => e.status === 'RELEASED');
    const buying = validEscrows.filter(e => e.buyerId === user?.id);
    const selling = validEscrows.filter(e => e.sellerId === user?.id);
    const disputed = validEscrows.filter(e => e.status === 'DISPUTED');
    const totalTransactions = validEscrows.length;
    const successRate = totalTransactions > 0 
      ? Math.round((completed.length / totalTransactions) * 100) 
      : 0;
    
    // Total value = active + completed (excludes cancelled)
    const totalValue = active.reduce((sum, e) => sum + e.amount, 0) + completed.reduce((sum, e) => sum + e.amount, 0);
    const activeValue = active.reduce((sum, e) => sum + e.amount, 0);
    const completedValue = completed.reduce((sum, e) => sum + e.amount, 0);
    
    const pendingActions = validEscrows.filter(e => {
      if (e.buyerId === user?.id) {
        return e.status === 'AWAITING_PAYMENT';
      } else {
        return e.status === 'AWAITING_SHIPMENT' || e.status === 'DELIVERED_PENDING_RELEASE';
      }
    });

    // Calculate trends (compare with previous period)
    const previousPeriodEscrows = rifts.filter(e => {
      if (timeFilter === 'all') return false;
      const now = new Date();
      const filterDate = new Date();
      const previousFilterDate = new Date();
      
      if (timeFilter === '30days') {
        filterDate.setDate(now.getDate() - 30);
        previousFilterDate.setDate(now.getDate() - 60);
      } else if (timeFilter === 'month') {
        filterDate.setMonth(now.getMonth() - 1);
        previousFilterDate.setMonth(now.getMonth() - 2);
      }
      
      const escrowDate = new Date(e.createdAt);
      return escrowDate >= previousFilterDate && escrowDate < filterDate;
    });
    
    const previousCompleted = previousPeriodEscrows.filter(e => e.status === 'RELEASED').length;
    const previousTotal = previousPeriodEscrows.filter(e => e.status !== 'CANCELLED').length;
    const previousSuccessRate = previousTotal > 0 
      ? Math.round((previousCompleted / previousTotal) * 100) 
      : 0;
    
    const valueTrend = previousPeriodEscrows.length > 0 
      ? totalValue - previousPeriodEscrows.filter(e => e.status !== 'CANCELLED').reduce((sum, e) => sum + e.amount, 0)
      : 0;
    const successTrend = successRate - previousSuccessRate;

    return {
      totalValue,
      activeValue,
      completedValue,
      activeCount: active.length,
      buyingCount: buying.length,
      sellingCount: selling.length,
      disputedCount: disputed.length,
      pendingActionsCount: pendingActions.length,
      pendingActions,
      totalTransactions,
      successRate,
      valueTrend,
      successTrend,
    };
  }, [filteredEscrows, rifts, user?.id, timeFilter]);

  const activeEscrows = useMemo(() => {
    return filteredEscrows.filter(e => 
      ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
    );
  }, [filteredEscrows]);

  const displayedEscrows = useMemo(() => {
    return activeEscrows;
  }, [activeEscrows]);

  const getActivityMessage = () => {
    if (metrics.activeCount === 0) {
      return 'No actions needed right now';
    }
    if (metrics.pendingActionsCount > 0) {
      return `You have ${metrics.pendingActionsCount} pending ${metrics.pendingActionsCount === 1 ? 'action' : 'actions'}`;
    }
    return `You have ${metrics.activeCount} active ${metrics.activeCount === 1 ? 'rift' : 'rifts'}`;
  };

  const getContextualMessage = () => {
    if (metrics.activeCount === 0 && metrics.pendingActionsCount === 0) {
      return 'You\'re all caught up.';
    }
    if (metrics.activeCount === 0) {
      return 'You currently have 0 active transactions.';
    }
    return null;
  };

  const getRecentActivity = () => {
    const sorted = [...filteredEscrows].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 6);

    return sorted.map(rift => {
      const isBuyer = rift.buyerId === user?.id;
      const otherParty = isBuyer ? rift.seller : rift.buyer;
      const name = otherParty.name || otherParty.email.split('@')[0];

      const riftNumber = rift.riftNumber ?? rift.id.slice(-4);
      let message = '';
      switch (rift.status) {
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
        default:
          message = `Rift #${riftNumber} — ${rift.status.replace(/_/g, ' ').toLowerCase()}`;
      }

      return { ...rift, message, name };
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: RiftTransaction['status']) => {
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

  const getStatusIcon = (status: RiftTransaction['status']) => {
    switch (status) {
      case 'RELEASED': return 'checkmark-circle';
      case 'REFUNDED': return 'arrow-back-circle';
      case 'DISPUTED': return 'warning';
      case 'CANCELLED': return 'close-circle';
      case 'AWAITING_PAYMENT': return 'card';
      case 'AWAITING_SHIPMENT': return 'cube';
      case 'IN_TRANSIT': return 'car';
      case 'DELIVERED_PENDING_RELEASE': return 'checkmark-done';
      default: return 'time';
    }
  };

  const renderEscrow = ({ item }: { item: RiftTransaction }) => {
    const isBuyer = item.buyerId === user?.id;
    const role = isBuyer ? 'Buyer' : 'Seller';
    const otherParty = isBuyer ? item.seller : item.buyer;
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push(`/rifts/${item.id}`)}
        style={styles.escrowCard}
      >
        <View style={styles.escrowCardShadow} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.escrowCardInner}>
          <View style={styles.escrowTopRow}>
            <View style={styles.escrowTitleRow}>
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
              <View style={styles.escrowTitleSection}>
                <View style={styles.escrowTitleRowTop}>
                  <Text style={styles.escrowTitle} numberOfLines={1}>
                    Rift #{item.riftNumber ?? item.id.slice(-4)}
                  </Text>
                </View>
                <View style={styles.escrowMetaRow}>
                  <Text style={styles.escrowType}>{item.itemType.replace(/_/g, ' ')}</Text>
                  <Text style={styles.escrowDot}>•</Text>
                  <Text style={styles.escrowRole}>{role}</Text>
                </View>
              </View>
            </View>
            <View style={styles.escrowStatusRight}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {item.status === 'AWAITING_PAYMENT' ? 'Awaiting Payment' :
                   item.status === 'AWAITING_SHIPMENT' ? 'Awaiting Shipment' :
                   item.status === 'IN_TRANSIT' ? 'In Transit' :
                   item.status === 'DELIVERED_PENDING_RELEASE' ? 'Pending Release' :
                   item.status === 'RELEASED' ? 'Released' :
                   item.status === 'REFUNDED' ? 'Refunded' :
                   item.status === 'DISPUTED' ? 'Disputed' :
                   item.status === 'CANCELLED' ? 'Cancelled' : item.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.escrowDivider} />

          <View style={styles.escrowBottomRow}>
            <View style={styles.amountSection}>
              <Text style={styles.otherParty}>{otherParty.name || otherParty.email.split('@')[0]}</Text>
            </View>
            <View style={styles.amountSectionRight}>
              <Text style={styles.amountValue}>{formatCurrency(item.amount, item.currency)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonLoader = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%', marginTop: 12 }]} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '50%', marginTop: 8 }]} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '70%', marginTop: 8 }]} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0C0C0C', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView 
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTextContainer}>
                <View style={[styles.skeletonLine, { width: 120, height: 14, marginBottom: 12 }]} />
                <View style={[styles.skeletonLine, { width: 180, height: 36 }]} />
              </View>
            </View>
          </View>
          {renderSkeletonLoader()}
        </ScrollView>
      </View>
    );
  }

  const recentActivity = getRecentActivity();
  const displayedActivity = recentActivity.slice(0, 6);
  const userName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0C0C0C', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.FlatList
        data={displayedEscrows}
        renderItem={renderEscrow}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
          />
        }
        ListHeaderComponent={
          <View>
            {/* SECTION 1: Header */}
            <Animated.View 
              style={[
                styles.header,
                {
                  opacity: scrollY.interpolate({
                    inputRange: [0, 100],
                    outputRange: [1, 0.95],
                    extrapolate: 'clamp',
                  }),
                }
              ]}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerGreeting}>
                    {new Date().getHours() < 12 ? 'Good morning' : 
                     new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
                  </Text>
                  <Text style={styles.headerName}>{userName}</Text>
                  {metrics.activeCount === 0 && metrics.pendingActionsCount === 0 && (
                    <Text style={styles.headerSubtext}>You're all set! Ready to create your first rift?</Text>
                  )}
                  {metrics.pendingActionsCount > 0 && (
                    <Text style={styles.headerSubtext}>
                      You have {metrics.pendingActionsCount} {metrics.pendingActionsCount === 1 ? 'action' : 'actions'} waiting
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* SECTION 2: Balance Card - Always Visible */}
            <View style={styles.portfolioCard}>
              <View style={styles.portfolioCardShadow} />
              <LinearGradient
                colors={['rgba(79, 70, 229, 0.08)', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(79, 70, 229, 0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.portfolioContent}>
                <View style={styles.portfolioHeader}>
                  <Text style={styles.portfolioLabel}>Your Balance</Text>
                  <Text style={styles.portfolioValue}>
                    {metrics.totalValue > 0 ? formatCurrency(metrics.totalValue, 'USD') : formatCurrency(0, 'USD')}
                  </Text>
                  <Text style={styles.portfolioSubtext}>
                    Total of active and completed transactions
                  </Text>
                </View>
                <View style={styles.portfolioStats}>
                  <View style={styles.portfolioStat}>
                    <Ionicons name="time-outline" size={18} color={Colors.info} style={styles.statIcon} />
                    <Text style={styles.portfolioStatValue}>{formatCurrency(metrics.activeValue, 'USD')}</Text>
                    <Text style={styles.portfolioStatLabel}>In Rifts</Text>
                  </View>
                  <View style={styles.portfolioStat}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} style={styles.statIcon} />
                    <Text style={styles.portfolioStatValue}>{formatCurrency(metrics.completedValue, 'USD')}</Text>
                    <Text style={styles.portfolioStatLabel}>Settled</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* SECTION 3: Actions Needed - Only when there are actions */}
            {metrics.pendingActionsCount > 0 && (
              <View style={styles.actionRequiredCard}>
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0.06)', 'rgba(59, 130, 246, 0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.actionRequiredContent}>
                  <View style={styles.actionHeader}>
                    <View style={styles.actionIconWrapper}>
                      <Ionicons name="notifications" size={24} color={Colors.info} />
                    </View>
                    <View style={styles.actionHeaderText}>
                      <Text style={styles.sectionTitle}>Action Required</Text>
                      <Text style={styles.actionSubtitle}>
                        {metrics.pendingActionsCount === 1 
                          ? '1 thing needs your attention'
                          : `${metrics.pendingActionsCount} things need your attention`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionList}>
                    {metrics.pendingActions.slice(0, 3).map((action) => {
                      const isBuyer = action.buyerId === user?.id;
                      let actionText = '';
                      let actionIcon = 'alert-circle';
                      let actionDescription = '';
                      if (isBuyer && action.status === 'AWAITING_PAYMENT') {
                        actionText = 'Complete payment';
                        actionDescription = `Pay ${formatCurrency(action.amount, action.currency)}`;
                        actionIcon = 'card';
                      } else if (!isBuyer && action.status === 'AWAITING_SHIPMENT') {
                        actionText = 'Ship your item';
                        actionDescription = 'Upload tracking information';
                        actionIcon = 'cube';
                      } else if (action.status === 'DELIVERED_PENDING_RELEASE') {
                        actionText = isBuyer ? 'Confirm you received it' : 'Release payment';
                        actionDescription = isBuyer ? 'Mark as delivered' : 'Send funds to seller';
                        actionIcon = 'checkmark-done';
                      }

                      return (
                        <TouchableOpacity
                          key={action.id}
                          style={styles.actionItem}
                          onPress={() => router.push(`/rifts/${action.id}`)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.actionItemLeft}>
                            <View style={styles.actionItemIcon}>
                              <Ionicons name={actionIcon as any} size={20} color={Colors.info} />
                            </View>
                            <View style={styles.actionItemTextContainer}>
                              <Text style={styles.actionItemText}>{actionText}</Text>
                              <Text style={styles.actionItemDescription}>{actionDescription}</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* SECTION 4: Recent Activity - Always Visible */}
            <View style={styles.activitySection}>
              <View style={styles.activityCard}>
                <View style={styles.activityCardContent}>
                  <View style={styles.activityHeader}>
                    <View style={styles.activityHeaderLeft}>
                      <Ionicons name="time" size={20} color={Colors.textSecondary} />
                      <Text style={styles.sectionTitle}>Recent Activity</Text>
                    </View>
                    {recentActivity.length > 0 && (
                      <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => router.push('/activity/all')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewAllButtonText}>View All</Text>
                        <Ionicons 
                          name="chevron-forward" 
                          size={14} 
                          color={Colors.textSecondary} 
                          style={styles.viewAllIcon}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  {recentActivity.length > 0 ? (
                    <>
                      {/* Decorative Separator */}
                      <View style={styles.activitySeparator}>
                        <View style={styles.activitySeparatorLine} />
                        <View style={styles.activitySeparatorDot} />
                        <View style={styles.activitySeparatorLine} />
                      </View>
                      <View style={styles.activityList}>
                        {displayedActivity.map((activity) => {
                          const getActivityIcon = () => {
                            if (activity.message.includes('completed') || activity.message.includes('released')) {
                              return 'checkmark-circle';
                            }
                            if (activity.message.includes('transit')) {
                              return 'cube';
                            }
                            if (activity.message.includes('payment')) {
                              return 'card';
                            }
                            if (activity.message.includes('cancelled')) {
                              return 'close';
                            }
                            return 'ellipse';
                          };

                          const getActivityColor = () => {
                            if (activity.message.includes('completed') || activity.message.includes('released')) {
                              return Colors.success;
                            }
                            if (activity.message.includes('transit')) {
                              return Colors.info;
                            }
                            if (activity.message.includes('cancelled')) {
                              return Colors.error;
                            }
                            return Colors.textTertiary;
                          };

                          return (
                            <View key={activity.id} style={styles.activityItem}>
                              <View style={[styles.activityIcon, { backgroundColor: getActivityColor() + '18' }]}>
                                <Ionicons name={getActivityIcon() as any} size={14} color={getActivityColor()} />
                              </View>
                              <Text style={styles.activityText}>{activity.message}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <View style={styles.noActivityContainer}>
                      <Text style={styles.noActivityText}>No recent activity</Text>
                      <Text style={styles.noActivitySubtext}>Your transaction activity will appear here</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* SECTION 5: Your Rifts */}
            <View style={styles.riftsContainer}>
              <View style={styles.riftsHeader}>
                <Text style={styles.sectionTitle}>Your Rifts</Text>
                {rifts.length > 0 && (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => router.push('/rifts/all')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllButtonText}>View All</Text>
                    <Ionicons 
                      name="chevron-forward" 
                      size={14} 
                      color={Colors.textSecondary} 
                      style={styles.viewAllIcon}
                    />
                  </TouchableOpacity>
                )}
              </View>
              {displayedEscrows.length === 0 && (
                <View style={styles.emptyEscrowsList}>
                  <View style={styles.emptyIconWrapper}>
                    <LinearGradient
                      colors={['rgba(79, 70, 229, 0.2)', 'rgba(139, 92, 246, 0.15)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.emptyIconGradient}
                    />
                    <Ionicons name="cube-outline" size={56} color={Colors.primary} />
                  </View>
                  <Text style={styles.emptyEscrowsTitle}>No rifts yet</Text>
                  <Text style={styles.emptyEscrowsText}>
                    Create your first rift to get started with protected transactions
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => router.push('/(tabs)/create')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle" size={20} color={Colors.text} />
                    <Text style={styles.emptyStateButtonText}>Create Rift</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={null}
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
    marginBottom: Spacing.lg + 4,
  },
  headerContent: {
    paddingHorizontal: Spacing.xl + 4,
    paddingBottom: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '300',
    marginBottom: 8,
    opacity: 0.6,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerName: {
    fontSize: 36,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.8,
    lineHeight: 42,
    marginBottom: Spacing.sm,
  },
  headerSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.8,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  timeFilterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  timeFilterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  timeFilterButtonActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  timeFilterText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  timeFilterTextActive: {
    color: Colors.primary,
    fontWeight: '500',
  },
  portfolioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  trendIndicatorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  trendTextSmall: {
    fontSize: 10,
    fontWeight: '500',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  createButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 6,
  },
  headerContext: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 120,
  },
  portfolioCard: {
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
  quickActionCard: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.xl + 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    position: 'relative',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  quickActionContent: {
    padding: Spacing.xl + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quickActionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTextContainer: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '400',
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  quickActionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.75,
    lineHeight: 20,
  },
  portfolioCardShadow: {
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
  portfolioContent: {
    padding: Spacing.xl + 4,
    paddingBottom: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  portfolioHeader: {
    marginBottom: Spacing.md + 2,
  },
  portfolioLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    opacity: 0.6,
  },
  portfolioValue: {
    fontSize: 42,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -1.6,
    lineHeight: 48,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  portfolioDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.75,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  portfolioSubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '400',
    opacity: 0.7,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  portfolioStats: {
    flexDirection: 'row',
    gap: Spacing.lg + 4,
    paddingTop: Spacing.lg + 4,
    marginTop: Spacing.lg + 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  portfolioStat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statIcon: {
    marginBottom: Spacing.sm + 2,
    opacity: 0.85,
  },
  portfolioStatValue: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: '300',
    marginBottom: 4,
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  portfolioStatLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
    opacity: 0.75,
    letterSpacing: 0.3,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  metricCard: {
    width: '47%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    minHeight: 100,
  },
  metricCardTopLeft: {
    marginRight: 0,
  },
  metricCardTopRight: {
    marginLeft: 0,
  },
  metricCardBottomLeft: {
    marginRight: 0,
  },
  metricCardBottomRight: {
    marginLeft: 0,
  },
  metricCardShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  metricCardContent: {
    padding: Spacing.lg + 2,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Spacing.sm + 2,
    position: 'relative',
    zIndex: 1,
  },
  metricCardTopLeft: {
    marginRight: 0,
  },
  metricCardTopRight: {
    marginLeft: 0,
  },
  metricCardBottomLeft: {
    marginRight: 0,
  },
  metricCardBottomRight: {
    marginLeft: 0,
  },
  metricCardValue: {
    fontSize: 28,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -1,
    lineHeight: 32,
  },
  metricCardLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
    opacity: 0.75,
    letterSpacing: 0.3,
  },
  additionalStatsRow: {
    paddingHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.lg + 4,
  },
  additionalStatCard: {
    borderRadius: 20,
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
  additionalStatContent: {
    padding: Spacing.lg + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  additionalStatTextContainer: {
    flex: 1,
  },
  additionalStatValue: {
    fontSize: 24,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.8,
    marginBottom: 2,
  },
  additionalStatLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
    opacity: 0.75,
  },
  actionRequiredCard: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.xl + 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    position: 'relative',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  actionRequiredContent: {
    padding: Spacing.xl + 6,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg + 6,
  },
  actionHeaderText: {
    flex: 1,
  },
  actionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.8,
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  riftsSection: {
    marginHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionList: {
    gap: Spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg + 4,
    paddingHorizontal: Spacing.lg + 2,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  actionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemTextContainer: {
    flex: 1,
    gap: 4,
  },
  actionItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  actionItemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.85,
    letterSpacing: -0.2,
  },
  noActionsContainer: {
    paddingVertical: Spacing.lg + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActionsText: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontWeight: '400',
    opacity: 0.7,
  },
  noActivityContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActivityText: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontWeight: '300',
    marginBottom: Spacing.xs,
    opacity: 0.8,
  },
  noActivitySubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '300',
    opacity: 0.6,
  },
  activitySection: {
    paddingHorizontal: Spacing.xl + 4,
    marginBottom: Spacing.xl + 12,
  },
  activityCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    position: 'relative',
  },
  activityCardContent: {
    padding: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  activityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  activitySeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  activitySeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  activitySeparatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  activityList: {
    gap: Spacing.xs + 2,
    marginTop: Spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs + 2,
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
  riftsContainer: {
    paddingHorizontal: Spacing.xl + 4,
    marginTop: Spacing.xl + 8,
    marginBottom: Spacing.lg,
  },
  riftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  viewAllButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '300',
    marginRight: Spacing.xs,
  },
  viewAllIcon: {
    marginLeft: 2,
  },
  emptyEscrowsList: {
    paddingVertical: Spacing.xxl + 12,
    paddingHorizontal: Spacing.xl + 4,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: Spacing.lg + 4,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg + 4,
    position: 'relative',
    overflow: 'hidden',
  },
  emptyIconGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
  },
  emptyEscrowsTitle: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: '300',
    marginBottom: Spacing.sm + 2,
    letterSpacing: -0.2,
  },
  emptyEscrowsText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg + 4,
    opacity: 0.8,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  emptyStateButtonText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400',
  },
  skeletonContainer: {
    paddingHorizontal: Spacing.xl + 4,
    gap: Spacing.md,
  },
  skeletonCard: {
    borderRadius: 20,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    width: '100%',
  },
  escrowCard: {
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
  escrowCardShadow: {
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
  escrowCardInner: {
    padding: Spacing.lg + 4,
    position: 'relative',
    zIndex: 1,
  },
  escrowTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md + 2,
    gap: Spacing.md,
  },
  escrowTitleRow: {
    flexDirection: 'row',
    flex: 1,
    flexShrink: 1,
    gap: Spacing.sm,
    minWidth: 0,
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginTop: 2,
  },
  escrowTitleSection: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  escrowTitleRowTop: {
    marginBottom: 6,
  },
  escrowTitle: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.5,
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
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  escrowDot: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  escrowRole: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  escrowStatusRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999, // rounded-full (pill shape) to match web
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)', // border-white/20
    backgroundColor: 'rgba(255, 255, 255, 0.10)', // bg-white/10
    maxWidth: '100%',
  },
  statusBadgeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.80)', // text-white/80
    fontWeight: '300', // font-light
    textAlign: 'center',
  },
  escrowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: Spacing.md,
  },
  escrowBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  amountSection: {
    flex: 1,
  },
  amountSectionRight: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.6,
  },
  otherParty: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  emptyContainer: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '300',
    letterSpacing: 0.2,
  },
});
