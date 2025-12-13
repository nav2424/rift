import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, EscrowTransaction } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import PremiumGlassCard from '@/components/PremiumGlassCard';
import GlassButton from '@/components/GlassButton';
import MessagingPanel from '@/components/MessagingPanel';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { subscribeToEscrow } from '@/lib/realtime-escrows';

export default function EscrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [escrow, setEscrow] = useState<EscrowTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  useEffect(() => {
    loadEscrow();
  }, [id]);

  // Real-time sync for this escrow
  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToEscrow(
      id as string,
      (update) => {
        // Update escrow when changes occur
        setEscrow((prev) => {
          if (!prev) return prev;
          return { ...prev, ...update };
        });
      },
      (error) => {
        console.error('Realtime escrow sync error:', error);
        // Silently fail - don't disrupt user experience
      }
    );

    return () => {
      unsubscribe();
    };
  }, [id]);

  const loadEscrow = async () => {
    try {
      const data = await api.getEscrow(id);
      setEscrow(data);
    } catch (error: any) {
      // Don't navigate away on errors - just show error and keep current state
      // Only navigate back if it's a 404 (escrow not found)
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        Alert.alert('Error', error.message || 'Rift not found');
        router.back();
      } else {
        // For other errors (including auth errors), just show message
        // Don't log user out - let them retry
        console.error('Error loading escrow:', error);
        if (!refreshing) {
          // Only show alert if not refreshing (to avoid spam)
          Alert.alert('Error', error.message || 'Failed to load rift. Please try again.');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEscrow();
  };

  const handlePayEscrow = async () => {
    if (!escrow) return;

    // Check if payment processing is configured
    const stripeKey = Constants.expoConfig?.extra?.stripePublishableKey || '';
    const isStripeConfigured = stripeKey && stripeKey !== 'pk_test_your_publishable_key_here' && stripeKey.length > 0;

    setActionLoading('mark-paid');
    try {
      // 1. Fund escrow - creates payment intent (new endpoint)
      const { clientSecret, paymentIntentId, buyerTotal } = await api.fundEscrow(escrow.id);

      if (!clientSecret || !paymentIntentId) {
        throw new Error('Failed to create payment intent. Please check your payment configuration.');
      }

      // 2. Initialize Payment Sheet
      // Note: Only allow card payments (no Link, no wallets)
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Rift',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          email: user?.email || undefined,
          name: user?.name || undefined,
        },
        allowsDelayedPaymentMethods: false,
        returnURL: 'rift://payment-result',
        // Disable wallets - only card payments
        applePay: undefined,
        googlePay: undefined,
      });

      if (initError) {
        console.error('Payment Sheet init error:', initError);
        throw new Error(initError.message || 'Failed to initialize payment. Please check your payment configuration.');
      }

      // 3. Present Payment Sheet - THIS IS WHERE THE USER PAYS
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User cancelled or error occurred
        if (presentError.code === 'Canceled') {
          setActionLoading(null);
          return;
        } else {
          console.error('Payment Sheet present error:', presentError);
          Alert.alert('Payment Error', presentError.message || 'Payment failed. Please try again.');
          setActionLoading(null);
          return;
        }
      }

      // 4. Payment Sheet completed successfully - confirm payment with backend
      try {
        const result = await api.confirmPayment(escrow.id, paymentIntentId);
        Alert.alert(
          'Payment Successful',
          `Payment processed successfully. Total: ${escrow.currency} ${buyerTotal.toFixed(2)}`,
          [{ text: 'OK', onPress: () => loadEscrow() }]
        );
      } catch (error: any) {
        Alert.alert('Error', 'Payment was processed but there was an error updating the escrow. Please contact support.');
        console.error('Error confirming payment:', error);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message || 'Failed to process payment. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (action: string) => {
    if (!escrow) return;

    setActionLoading(action);
    try {
      switch (action) {
        case 'mark-paid':
          // This shouldn't be called directly anymore, use handlePayEscrow instead
          await api.markPaid(escrow.id);
          break;
        case 'cancel':
          Alert.alert(
            'Cancel Escrow',
            'Are you sure you want to cancel this escrow?',
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Yes',
                onPress: async () => {
                  try {
                    setActionLoading('cancel');
                    await api.cancelEscrow(escrow.id);
                    // Reload escrow to show updated status
                    await loadEscrow();
                    // Navigate back to dashboard so user sees updated metrics immediately
                    router.back();
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Failed to cancel escrow. Please try again.');
                  } finally {
                    setActionLoading(null);
                  }
                },
              },
            ]
          );
          return;
        case 'confirm-received':
          await api.confirmReceived(escrow.id);
          if (escrow.itemType !== 'PHYSICAL') {
            Alert.alert(
              'Funds Released!',
              `The seller has received payment. Thank you for using Rift!`,
              [{ text: 'OK', onPress: () => loadEscrow() }]
            );
          }
          break;
        case 'release-funds':
          const releaseResult = await api.releaseFunds(escrow.id);
          Alert.alert(
            'Funds Released!',
            'The seller has been notified and will receive payment.',
            [{ text: 'OK', onPress: () => loadEscrow() }]
          );
          break;
        case 'upload-proof':
          await handleUploadProof();
          return;
        case 'mark-delivered':
          await handleMarkDelivered();
          return;
        case 'raise-dispute':
          handleRaiseDispute();
          return;
      }
      loadEscrow();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadProof = async () => {
    if (!escrow) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // For physical items, prompt for tracking info
      if (escrow.itemType === 'PHYSICAL') {
        Alert.prompt(
          'Upload Shipment Proof',
          'Enter tracking number',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upload',
              onPress: async (trackingNumber) => {
                try {
                  setActionLoading('upload-proof');
                  // Use new proof system
                  const proofPayload: any = {};
                  if (trackingNumber) proofPayload.trackingNumber = trackingNumber;
                  
                  // In production, upload file to storage service first, then use URL
                  const uploadedFiles = [result.assets[0].uri]; // Should be file URLs after upload
                  
                  await api.submitProof(escrow.id, {
                    proofPayload,
                    uploadedFiles,
                  });
                  Alert.alert('Success', 'Proof submitted successfully');
                  loadEscrow();
                } catch (error: any) {
                  Alert.alert('Error', error.message || 'Upload failed');
                } finally {
                  setActionLoading(null);
                }
              },
            },
          ],
          'plain-text'
        );
      } else {
        // For non-physical items, just upload with optional notes
        Alert.prompt(
          'Upload Delivery Proof',
          'Add optional notes',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upload',
              onPress: async (notes) => {
                try {
                  setActionLoading('upload-proof');
                  const proofPayload: any = {};
                  if (notes) proofPayload.notes = notes;
                  
                  const uploadedFiles = [result.assets[0].uri];
                  
                  await api.submitProof(escrow.id, {
                    proofPayload,
                    uploadedFiles,
                  });
                  Alert.alert('Success', 'Proof submitted successfully');
                  loadEscrow();
                } catch (error: any) {
                  Alert.alert('Error', error.message || 'Upload failed');
                } finally {
                  setActionLoading(null);
                }
              },
            },
          ],
          'plain-text'
        );
      }
    }
  };

  const handleMarkDelivered = async () => {
    if (!escrow) return;

    // Determine proof type based on item type
    const proofType = 
      escrow.itemType === 'DIGITAL' ? 'proof of digital product transfer (screenshot, license key, etc.)' :
      escrow.itemType === 'TICKETS' ? 'proof of ticket transfer (screenshot of transfer confirmation, email, etc.)' :
      'proof of service completion (photos, completion certificate, etc.)';

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload proof');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Prompt for optional notes
      Alert.prompt(
        'Upload Delivery Proof',
        `Please upload ${proofType}. You can add optional notes below:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload',
            onPress: async (notes) => {
              try {
                setActionLoading('mark-delivered');
                // Use new proof system
                const proofPayload: any = {};
                if (notes) proofPayload.notes = notes;
                
                const uploadedFiles = [result.assets[0].uri];
                
                const result = await api.submitProof(escrow.id, {
                  proofPayload,
                  uploadedFiles,
                });
                Alert.alert('Success', 'Proof uploaded successfully. Buyer has 24 hours to review.');
                loadEscrow();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to upload proof');
              } finally {
                setActionLoading(null);
              }
            },
          },
        ],
        'plain-text'
      );
    }
  };

  const handleRaiseDispute = () => {
    if (!escrow) return;

    // Determine available dispute types based on status
    // Can only dispute between FUNDED and before RELEASED
    const canDispute = ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(escrow.status);
    
    if (!canDispute) {
      Alert.alert('Cannot Dispute', `Cannot open a dispute in ${escrow.status} status. Disputes can only be opened after payment and before funds are released.`);
      return;
    }

    // Standard dispute types
    const disputeTypes = [
      { label: 'Item Not Received', value: 'ITEM_NOT_RECEIVED' },
      { label: 'Item Not as Described', value: 'ITEM_NOT_AS_DESCRIBED' },
      { label: 'Item Damaged', value: 'ITEM_DAMAGED' },
      { label: 'Wrong Item', value: 'WRONG_ITEM' },
      { label: 'Wrong Address', value: 'WRONG_ADDRESS' },
      { label: 'Other', value: 'OTHER' },
    ];

    // Show dispute type selection
    Alert.alert(
      'Raise Dispute',
      'Select the type of dispute:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...disputeTypes.map(type => ({
          text: type.label,
          onPress: () => {
            Alert.prompt(
              'Dispute Details',
              `Please explain why this is a "${type.label}" dispute`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Submit',
                  onPress: async (reason) => {
                    if (!reason) {
                      Alert.alert('Error', 'Please provide a reason');
                      return;
                    }
                    try {
                      setActionLoading('raise-dispute');
                      await api.raiseDispute(escrow.id, reason, type.value);
                      Alert.alert('Success', 'Dispute opened successfully');
                      loadEscrow();
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to raise dispute');
                    } finally {
                      setActionLoading(null);
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        })),
      ]
    );
  };

  if (loading || !escrow) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.text} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const isBuyer = escrow.buyerId === user?.id;
  const isSeller = escrow.sellerId === user?.id;
  const currentUserRole = isBuyer ? 'BUYER' : isSeller ? 'SELLER' : 'ADMIN';

  // Debug logging (can be removed later)
  if (__DEV__) {
    console.log('Escrow Debug:', {
      userId: user?.id,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      isBuyer,
      isSeller,
      currentUserRole,
      status: escrow.status,
    });
  }

  const getStatusColor = (status: EscrowTransaction['status']) => {
    switch (status) {
      case 'RELEASED':
      case 'PAID_OUT':
        return '#4ade80';
      case 'REFUNDED':
      case 'CANCELED':
      case 'CANCELLED':
        return '#f87171';
      case 'DISPUTED':
      case 'UNDER_REVIEW':
        return '#fbbf24';
      case 'FUNDED':
      case 'PROOF_SUBMITTED':
        return '#60a5fa';
      case 'AWAITING_PAYMENT':
        return '#a78bfa';
      default:
        return '#60a5fa';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" colors={['#ffffff']} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        <PremiumGlassCard variant="premium" gradient style={styles.headerCard}>
          <View style={styles.headerCardContent}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{escrow.itemTitle}</Text>
              <Text style={styles.itemType}>{escrow.itemType.replace(/_/g, ' ')}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { 
                  backgroundColor: getStatusColor(escrow.status) + '25',
                  borderColor: getStatusColor(escrow.status) + '50',
                },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(escrow.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(escrow.status) }]}>
                {escrow.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        </PremiumGlassCard>

        <PremiumGlassCard variant="premium" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction Amount</Text>
            <Text style={styles.detailValue}>
              {escrow.subtotal || escrow.amount} {escrow.currency}
            </Text>
          </View>
          {escrow.buyerFee && escrow.buyerFee > 0 && isBuyer && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Processing Fee (3%)</Text>
                <Text style={styles.detailValue}>
                  +{escrow.buyerFee.toFixed(2)} {escrow.currency}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontWeight: '600' }]}>Total You Pay</Text>
                <Text style={[styles.detailValue, { color: '#4ade80', fontWeight: '600' }]}>
                  {((escrow.subtotal || escrow.amount) + escrow.buyerFee).toFixed(2)} {escrow.currency}
                </Text>
              </View>
            </>
          )}
          {escrow.sellerFee && escrow.sellerFee > 0 && isSeller && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Platform Fee (5%)</Text>
                <Text style={styles.detailValue}>
                  -{escrow.sellerFee.toFixed(2)} {escrow.currency}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontWeight: '600' }]}>You Receive</Text>
                <Text style={[styles.detailValue, { color: '#4ade80', fontWeight: '600' }]}>
                  {escrow.sellerNet?.toFixed(2) || ((escrow.subtotal || escrow.amount) - escrow.sellerFee).toFixed(2)} {escrow.currency}
                </Text>
              </View>
            </>
          )}
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Buyer</Text>
            <Text style={styles.detailValue}>{escrow.buyer.name || escrow.buyer.email}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Seller</Text>
            <Text style={styles.detailValue}>{escrow.seller.name || escrow.seller.email}</Text>
          </View>
          
          {/* Type-specific fields */}
          {escrow.itemType === 'PHYSICAL' && escrow.shippingAddress && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shipping Address</Text>
                <Text style={styles.detailValue}>{escrow.shippingAddress}</Text>
              </View>
            </>
          )}
          
          {escrow.itemType === 'TICKETS' && (
            <>
              {escrow.eventDate && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Event Date</Text>
                    <Text style={styles.detailValue}>{escrow.eventDate}</Text>
                  </View>
                </>
              )}
              {escrow.venue && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Venue</Text>
                    <Text style={styles.detailValue}>{escrow.venue}</Text>
                  </View>
                </>
              )}
              {escrow.transferMethod && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transfer Method</Text>
                    <Text style={styles.detailValue}>{escrow.transferMethod}</Text>
                  </View>
                </>
              )}
            </>
          )}
          
          {escrow.itemType === 'DIGITAL' && escrow.downloadLink && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Download Link</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{escrow.downloadLink}</Text>
              </View>
            </>
          )}
          
          {escrow.itemType === 'SERVICES' && escrow.serviceDate && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Date</Text>
                <Text style={styles.detailValue}>{escrow.serviceDate}</Text>
              </View>
            </>
          )}
          
          {escrow.itemDescription && (
          <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.description}>{escrow.itemDescription}</Text>
          </View>
          )}

          {/* Verification Status (Hybrid Protection - PHYSICAL ONLY) */}
          {escrow.itemType === 'PHYSICAL' && escrow.shipmentVerifiedAt && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shipment Verified</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" style={{ marginRight: 6 }} />
                  <Text style={[styles.detailValue, { color: '#4ade80' }]}>Verified</Text>
                </View>
              </View>
              {escrow.trackingVerified && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tracking Verified</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailValue, { color: '#4ade80' }]}>Valid</Text>
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          {/* Auto-Release Info for Non-Physical Items */}
          {escrow.itemType !== 'PHYSICAL' && escrow.status === 'IN_TRANSIT' && escrow.gracePeriodEndsAt && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.autoReleaseContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="shield-checkmark" size={16} color="#60a5fa" style={{ marginRight: 6 }} />
                  <Text style={styles.autoReleaseLabel}>Protection Window</Text>
                </View>
                <Text style={styles.autoReleaseText}>
                  Seller marked as delivered. Funds will auto-release on:{'\n'}
                  <Text style={{ fontWeight: '700' }}>
                    {new Date(escrow.gracePeriodEndsAt).toLocaleString()}
                  </Text>
                </Text>
                {isBuyer && (
                  <Text style={styles.autoReleaseNote}>
                    You can release funds early if satisfied, or raise a dispute if there's an issue. Funds auto-release after 24 hours if no action is taken.
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Grace Period Countdown (Physical Items Only) */}
          {escrow.itemType === 'PHYSICAL' && escrow.gracePeriodEndsAt && escrow.autoReleaseScheduled && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.gracePeriodContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="time-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                  <Text style={styles.gracePeriodLabel}>Auto-Release Timer</Text>
                </View>
                <Text style={styles.gracePeriodText}>
                  Funds will auto-release on:{'\n'}
                  <Text style={{ fontWeight: '700' }}>
                    {new Date(escrow.gracePeriodEndsAt).toLocaleString()}
                  </Text>
                </Text>
                {isBuyer && escrow.itemType === 'PHYSICAL' && (
                  <Text style={styles.gracePeriodNote}>
                    You can still dispute: item not as described, damaged, wrong item, or wrong address before this time.
                  </Text>
                )}
                {isBuyer && escrow.itemType !== 'PHYSICAL' && (
                  <Text style={styles.gracePeriodNote}>
                    You can dispute any issues before this time. Funds will automatically release after the grace period.
                  </Text>
                )}
              </View>
            </>
          )}
        </PremiumGlassCard>

        {/* Actions */}
        <PremiumGlassCard variant="premium" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsContainer}>
            {(() => {
              const actions: React.ReactElement[] = [];
              
              // Buyer actions
              if (currentUserRole === 'BUYER' && escrow.status === 'AWAITING_PAYMENT') {
                const buyerTotal = (escrow.subtotal || escrow.amount || 0) + (escrow.buyerFee || 0);
                actions.push(
                  <GlassButton
                    key="pay-escrow"
                    title={actionLoading === 'mark-paid' ? 'Processing Payment...' : `Pay Rift ${escrow.currency} ${buyerTotal.toFixed(2)}`}
                    onPress={() => handlePayEscrow()}
                    variant="primary"
                    size="md"
                    disabled={actionLoading === 'mark-paid'}
                    loading={actionLoading === 'mark-paid'}
                    style={styles.actionButton}
                  />
                );
                actions.push(
                  <GlassButton
                    key="cancel"
                    title="Cancel Rift"
                    onPress={() => handleAction('cancel')}
                    variant="outline"
                    size="md"
                    style={styles.actionButton}
                  />
                );
              }

              // Buyer: Release funds (after proof submitted)
              if (currentUserRole === 'BUYER' && 
                (escrow.status === 'PROOF_SUBMITTED' || escrow.status === 'UNDER_REVIEW')) {
                actions.push(
                  <GlassButton
                    key="release-funds"
                    title={actionLoading === 'release-funds' ? 'Processing...' : 'Release Funds to Seller'}
                    onPress={() => handleAction('release-funds')}
                    variant="primary"
                    size="md"
                    disabled={actionLoading === 'release-funds'}
                    loading={actionLoading === 'release-funds'}
                    style={styles.actionButton}
                  />
                );
              }

              // Seller actions: Submit proof (after funded)
              if (currentUserRole === 'SELLER' && 
                (escrow.status === 'FUNDED' || escrow.status === 'AWAITING_SHIPMENT')) {
                if (escrow.itemType === 'PHYSICAL') {
                  actions.push(
                    <GlassButton
                      key="upload-proof"
                      title={actionLoading === 'upload-proof' ? 'Uploading...' : 'Submit Shipment Proof'}
                      onPress={() => handleAction('upload-proof')}
                      variant="primary"
                      size="md"
                      disabled={actionLoading === 'upload-proof'}
                      loading={actionLoading === 'upload-proof'}
                      style={styles.actionButton}
                    />
                  );
                } else {
                  // Non-physical items: Submit delivery proof
                  const deliverButtonTitle = 
                    escrow.itemType === 'DIGITAL' ? 'Submit Delivery Proof' :
                    escrow.itemType === 'TICKETS' ? 'Submit Transfer Proof' :
                    'Submit Completion Proof';
                  
                  actions.push(
                    <GlassButton
                      key="mark-delivered"
                      title={actionLoading === 'mark-delivered' ? 'Processing...' : deliverButtonTitle}
                      onPress={() => handleAction('mark-delivered')}
                      variant="primary"
                      size="md"
                      disabled={actionLoading === 'mark-delivered'}
                      loading={actionLoading === 'mark-delivered'}
                      style={styles.actionButton}
                    />
                  );
                }
              }

              // Dispute action (buyer can dispute between FUNDED and before RELEASED)
              if (currentUserRole === 'BUYER' &&
                (escrow.status === 'FUNDED' || escrow.status === 'PROOF_SUBMITTED' || escrow.status === 'UNDER_REVIEW')) {
                actions.push(
                  <GlassButton
                    key="raise-dispute"
                    title="Raise Dispute"
                    onPress={() => handleAction('raise-dispute')}
                    variant="outline"
                    size="md"
                    style={styles.actionButton}
                  />
                );
              }

              // Show actions or empty state
              if (actions.length > 0) {
                return actions;
              } else {
                return (
                  <View key="empty" style={styles.emptyActionsContainer}>
                    <Ionicons name="checkmark-circle-outline" size={32} color={Colors.textTertiary} />
                    <Text style={styles.emptyActionsText}>
                      {escrow.status === 'RELEASED' || escrow.status === 'PAID_OUT' || escrow.status === 'REFUNDED' || escrow.status === 'CANCELLED' || escrow.status === 'CANCELED'
                        ? 'No actions available. This rift has been completed.'
                        : 'No actions available at this time.'}
                    </Text>
                  </View>
                );
              }
            })()}
          </View>
        </PremiumGlassCard>

        {/* New Proof System Display */}
        {escrow.proofs && escrow.proofs.length > 0 && (
          <PremiumGlassCard variant="premium" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Proof of Delivery</Text>
            {escrow.proofs.map((proof: any) => (
              <View key={proof.id} style={styles.proofCard}>
                <View style={styles.proofHeader}>
                  <Text style={styles.proofType}>
                    {proof.proofType.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[
                    styles.proofStatus,
                    { color: proof.status === 'VALID' ? '#4ade80' : proof.status === 'REJECTED' ? '#f87171' : '#fbbf24' }
                  ]}>
                    {proof.status}
                  </Text>
                </View>
                {proof.rejectionReason && (
                  <Text style={styles.proofRejection}>
                    {proof.rejectionReason}
                  </Text>
                )}
                {proof.uploadedFiles && proof.uploadedFiles.length > 0 && (
                  <View style={styles.proofFiles}>
                    {proof.uploadedFiles.map((file: string, idx: number) => (
                      <TouchableOpacity key={idx} onPress={() => {/* Open file */}}>
                        <Text style={styles.proofFileLink}>View File {idx + 1} →</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.proofDate}>
                  Submitted: {new Date(proof.submittedAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </PremiumGlassCard>
        )}

        {/* Legacy Shipment Proofs (for backward compatibility) */}
        {escrow.itemType === 'PHYSICAL' && escrow.shipmentProofs && escrow.shipmentProofs.length > 0 && (
          <PremiumGlassCard variant="premium" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Shipment Proofs</Text>
            {escrow.shipmentProofs.map((proof: any) => (
              <View key={proof.id} style={styles.proofCard}>
                {proof.trackingNumber && (
                  <Text style={styles.detailValue}>Tracking: {proof.trackingNumber}</Text>
                )}
                {proof.shippingCarrier && (
                  <Text style={styles.detailValue}>Carrier: {proof.shippingCarrier}</Text>
                )}
                <Text style={styles.proofDate}>
                  {new Date(proof.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </PremiumGlassCard>
        )}

        {/* Messaging Panel */}
        <MessagingPanel transactionId={escrow.id} />

        {/* Timeline */}
        {escrow.timelineEvents && escrow.timelineEvents.length > 0 && (
          <PremiumGlassCard variant="premium" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {escrow.timelineEvents.map((event, index) => (
              <View key={event.id}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineMessage}>{event.message}</Text>
                    <Text style={styles.timelineDate}>
                      {new Date(event.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
                {index < escrow.timelineEvents!.length - 1 && <View style={styles.timelineConnector} />}
              </View>
            ))}
          </PremiumGlassCard>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  headerCard: {
    padding: 24,
    marginBottom: 20,
  },
  headerCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  itemType: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    padding: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
  detailValue: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  descriptionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 22,
    fontWeight: '300',
  },
  gracePeriodContainer: {
    padding: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    marginTop: 12,
  },
  gracePeriodLabel: {
    fontSize: 13,
    color: '#fbbf24',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gracePeriodText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 8,
  },
  gracePeriodNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 4,
  },
  autoReleaseContainer: {
    padding: 16,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    marginTop: 12,
  },
  autoReleaseLabel: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autoReleaseText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 8,
  },
  autoReleaseNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionsContainer: {
    minHeight: 60,
  },
  actionButton: {
    marginBottom: 12,
  },
  emptyActionsContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionsText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 16,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineMessage: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 6,
    fontWeight: '400',
  },
  timelineDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '300',
  },
  timelineConnector: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 5,
    marginVertical: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  proofCard: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  proofHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proofType: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  proofStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  proofRejection: {
    fontSize: 13,
    color: '#f87171',
    marginTop: 8,
    fontStyle: 'italic',
  },
  proofFiles: {
    marginTop: 12,
    gap: 8,
  },
  proofFileLink: {
    fontSize: 14,
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  proofDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
});

