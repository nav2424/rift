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
import { api, RiftTransaction } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import PremiumGlassCard from '@/components/PremiumGlassCard';
import GlassButton from '@/components/GlassButton';
import MessagingPanel from '@/components/MessagingPanel';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { subscribeToEscrow } from '@/lib/realtime-rifts';

export default function EscrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rift, setEscrow] = useState<RiftTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  useEffect(() => {
    loadEscrow();
  }, [id]);

  // Real-time sync for this rift
  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToEscrow(
      id as string,
      (update) => {
        // Update rift when changes occur
        setEscrow((prev) => {
          if (!prev) return prev;
          return { ...prev, ...update };
        });
      },
      (error) => {
        console.error('Realtime rift sync error:', error);
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
      // Only navigate back if it's a 404 (rift not found) AND we're not in a refresh cycle
      // This prevents showing "Rift not found" immediately after creating a rift
      if ((error.message?.includes('404') || error.message?.includes('not found')) && !refreshing) {
        // Only show error if we're not in a refresh cycle (which happens after creation)
        // Wait a bit to see if it's just a timing issue
        setTimeout(() => {
          Alert.alert('Error', error.message || 'Rift not found');
          router.back();
        }, 1000);
      } else if (!refreshing) {
        // For other errors (including auth errors), just show message
        // Don't log user out - let them retry
        console.error('Error loading rift:', error);
        // Only show alert if not refreshing (to avoid spam)
        Alert.alert('Error', error.message || 'Failed to load rift. Please try again.');
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
    if (!rift) return;

    // Check if payment processing is configured
    const stripeKey = Constants.expoConfig?.extra?.stripePublishableKey || '';
    const isStripeConfigured = stripeKey && stripeKey !== 'pk_test_your_publishable_key_here' && stripeKey.length > 0;

    setActionLoading('mark-paid');
    try {
      // 1. Fund rift - creates payment intent (new endpoint)
      const { clientSecret, paymentIntentId, buyerTotal } = await api.fundEscrow(rift.id);

      if (!clientSecret || !paymentIntentId) {
        throw new Error('Failed to create payment intent. Please check your payment configuration.');
      }

      // 2. Initialize Payment Sheet
      // PaymentIntent now supports both us_bank_account (Plaid) and card
      // Bank transfers are prioritized and shown first
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Rift',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          email: user?.email || undefined,
          name: user?.name || undefined,
        },
        allowsDelayedPaymentMethods: true, // Required for ACH bank transfers (us_bank_account)
        returnURL: 'rift://payment-result',
        // Disable wallets - prioritize bank transfers and cards
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
        const result = await api.confirmPayment(rift.id, paymentIntentId);
        Alert.alert(
          'Payment Successful',
          `Payment processed successfully. Total: ${rift.currency} ${buyerTotal.toFixed(2)}`,
          [{ text: 'OK', onPress: () => loadEscrow() }]
        );
      } catch (error: any) {
        Alert.alert('Error', 'Payment was processed but there was an error updating the rift. Please contact support.');
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
    if (!rift) return;

    setActionLoading(action);
    try {
      switch (action) {
        case 'mark-paid':
          // This shouldn't be called directly anymore, use handlePayEscrow instead
          await api.markPaid(rift.id);
          break;
        case 'cancel':
          Alert.alert(
            'Cancel Rift',
            'Are you sure you want to cancel this rift?',
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Yes',
                onPress: async () => {
                  try {
                    setActionLoading('cancel');
                    await api.cancelEscrow(rift.id);
                    // Reload rift to show updated status
                    await loadEscrow();
                    // Navigate back to dashboard so user sees updated metrics immediately
                    router.back();
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Failed to cancel rift. Please try again.');
                  } finally {
                    setActionLoading(null);
                  }
                },
              },
            ]
          );
          return;
        case 'confirm-received':
          await api.confirmReceived(rift.id);
          if (rift.itemType !== 'PHYSICAL') {
            Alert.alert(
              'Funds Released!',
              `The seller has received payment. Thank you for using Rift!`,
              [{ text: 'OK', onPress: () => loadEscrow() }]
            );
          }
          break;
        case 'release-funds':
          const releaseResult = await api.releaseFunds(rift.id);
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
    if (!rift) return;

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
      if (rift.itemType === 'PHYSICAL') {
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
                  
                  await api.submitProof(rift.id, {
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
                  
                  await api.submitProof(rift.id, {
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
    if (!rift) return;

    // Determine proof type based on item type
    const proofType = 
      rift.itemType === 'DIGITAL_GOODS' ? 'proof of digital goods transfer (screenshot, license key, etc.)' :
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
                
                const result = await api.submitProof(rift.id, {
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
    if (!rift) return;

    // Determine available dispute types based on status
    // Can only dispute between PAID and before RELEASED
    const canDispute = ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status);
    
    if (!canDispute) {
      Alert.alert('Cannot Dispute', `Cannot open a dispute in ${rift.status} status. Disputes can only be opened after payment and before funds are released.`);
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
                      await api.raiseDispute(rift.id, reason, type.value);
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

  if (loading || !rift) {
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

  const isBuyer = rift.buyerId === user?.id;
  const isSeller = rift.sellerId === user?.id;
  const currentUserRole = isBuyer ? 'BUYER' : isSeller ? 'SELLER' : 'ADMIN';

  // Debug logging (can be removed later)
  if (__DEV__) {
    console.log('Rift Debug:', {
      userId: user?.id,
      buyerId: rift.buyerId,
      sellerId: rift.sellerId,
      isBuyer,
      isSeller,
      currentUserRole,
      status: rift.status,
    });
  }

  const getStatusColor = (status: RiftTransaction['status']) => {
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
              <Text style={styles.title}>{rift.itemTitle}</Text>
              <Text style={styles.itemType}>{rift.itemType.replace(/_/g, ' ')}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { 
                  backgroundColor: getStatusColor(rift.status) + '25',
                  borderColor: getStatusColor(rift.status) + '50',
                },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(rift.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(rift.status) }]}>
                {rift.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        </PremiumGlassCard>

        <PremiumGlassCard variant="premium" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction Amount</Text>
            <Text style={styles.detailValue}>
              {((rift.subtotal || rift.amount) || 0).toFixed(2)} {rift.currency}
            </Text>
          </View>
          {rift.buyerFee && rift.buyerFee > 0 && isBuyer && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Processing Fee (3%)</Text>
                <Text style={styles.detailValue}>
                  +{rift.buyerFee.toFixed(2)} {rift.currency}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontWeight: '600' }]}>Total You Pay</Text>
                <Text style={[styles.detailValue, { color: '#4ade80', fontWeight: '600' }]}>
                  {((rift.subtotal || rift.amount) + rift.buyerFee).toFixed(2)} {rift.currency}
                </Text>
              </View>
            </>
          )}
          {rift.sellerFee && rift.sellerFee > 0 && isSeller && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Platform Fee (5%)</Text>
                <Text style={styles.detailValue}>
                  -{rift.sellerFee.toFixed(2)} {rift.currency}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontWeight: '600' }]}>You Receive</Text>
                <Text style={[styles.detailValue, { color: '#4ade80', fontWeight: '600' }]}>
                  {rift.sellerNet?.toFixed(2) || ((rift.subtotal || rift.amount) - rift.sellerFee).toFixed(2)} {rift.currency}
                </Text>
              </View>
            </>
          )}
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Buyer</Text>
            <Text style={styles.detailValue}>{rift.buyer.name || rift.buyer.email}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Seller</Text>
            <Text style={styles.detailValue}>{rift.seller.name || rift.seller.email}</Text>
          </View>
          
          {/* Type-specific fields */}
          {rift.itemType === 'PHYSICAL' && rift.shippingAddress && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shipping Address</Text>
                <Text style={styles.detailValue}>{rift.shippingAddress}</Text>
              </View>
            </>
          )}
          
          {rift.itemType === 'TICKETS' && (
            <>
              {rift.eventDate && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Event Date</Text>
                    <Text style={styles.detailValue}>{rift.eventDate}</Text>
                  </View>
                </>
              )}
              {rift.venue && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Venue</Text>
                    <Text style={styles.detailValue}>{rift.venue}</Text>
                  </View>
                </>
              )}
              {rift.transferMethod && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transfer Method</Text>
                    <Text style={styles.detailValue}>{rift.transferMethod}</Text>
                  </View>
                </>
              )}
            </>
          )}
          
          {rift.itemType === 'DIGITAL_GOODS' && rift.downloadLink && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Download Link</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{rift.downloadLink}</Text>
              </View>
            </>
          )}
          
          {rift.itemType === 'SERVICES' && rift.serviceDate && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Date</Text>
                <Text style={styles.detailValue}>{rift.serviceDate}</Text>
              </View>
            </>
          )}
          
          {rift.itemDescription && (
          <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.description}>{rift.itemDescription}</Text>
          </View>
          )}

          {/* Verification Status (Hybrid Protection - PHYSICAL ONLY) */}
          {rift.itemType === 'PHYSICAL' && rift.shipmentVerifiedAt && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shipment Verified</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" style={{ marginRight: 6 }} />
                  <Text style={[styles.detailValue, { color: '#4ade80' }]}>Verified</Text>
                </View>
              </View>
              {rift.trackingVerified && (
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
          {rift.itemType !== 'PHYSICAL' && rift.status === 'IN_TRANSIT' && rift.gracePeriodEndsAt && (
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
                    {new Date(rift.gracePeriodEndsAt).toLocaleString()}
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
          {rift.itemType === 'PHYSICAL' && rift.gracePeriodEndsAt && rift.autoReleaseScheduled && (
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
                    {new Date(rift.gracePeriodEndsAt).toLocaleString()}
                  </Text>
                </Text>
                {isBuyer && rift.itemType === 'PHYSICAL' && (
                  <Text style={styles.gracePeriodNote}>
                    You can still dispute: item not as described, damaged, wrong item, or wrong address before this time.
                  </Text>
                )}
                {isBuyer && rift.itemType !== 'PHYSICAL' && (
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
              if (currentUserRole === 'BUYER' && rift.status === 'AWAITING_PAYMENT') {
                const buyerTotal = (rift.subtotal || rift.amount || 0) + (rift.buyerFee || 0);
                actions.push(
                  <GlassButton
                    key="pay-rift"
                    title={actionLoading === 'mark-paid' ? 'Processing Payment...' : `Pay Rift ${rift.currency} ${buyerTotal.toFixed(2)}`}
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
                (rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW')) {
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

              // Seller actions: Submit proof (after paid)
              if (currentUserRole === 'SELLER' && 
                (rift.status === 'FUNDED' || rift.status === 'AWAITING_SHIPMENT')) {
                if (rift.itemType === 'PHYSICAL') {
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
                    rift.itemType === 'DIGITAL_GOODS' ? 'Submit Delivery Proof' :
                    rift.itemType === 'TICKETS' ? 'Submit Transfer Proof' :
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

              // Dispute action (buyer can dispute between PAID and before RELEASED)
              if (currentUserRole === 'BUYER' &&
                (rift.status === 'FUNDED' || rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW')) {
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
                      {rift.status === 'RELEASED' || rift.status === 'PAID_OUT' || rift.status === 'REFUNDED' || rift.status === 'CANCELLED' || rift.status === 'CANCELED'
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
        {rift.proofs && rift.proofs.length > 0 && (
          <PremiumGlassCard variant="premium" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Proof of Delivery</Text>
            {rift.proofs.map((proof: any) => (
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
        {rift.itemType === 'PHYSICAL' && rift.shipmentProofs && rift.shipmentProofs.length > 0 && (
          <PremiumGlassCard variant="premium" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Shipment Proofs</Text>
            {rift.shipmentProofs.map((proof: any) => (
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
        <MessagingPanel transactionId={rift.id} />

        {/* Timeline */}
        {rift.timelineEvents && rift.timelineEvents.length > 0 && (
          <PremiumGlassCard variant="premium" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {rift.timelineEvents.map((event, index) => {
              // Filter fee information based on user role
              let filteredMessage = event.message
              if (isBuyer && !isSeller) {
                // Remove seller fee details for buyers
                filteredMessage = filteredMessage.replace(/Seller receives[^.]*(\([^)]*platform fee[^)]*\))?/gi, '')
                filteredMessage = filteredMessage.replace(/\.\s*Total fee.*?Seller receives:[^.]*/gi, '')
                filteredMessage = filteredMessage.replace(/\([^)]*platform fee[^)]*deducted[^)]*\)/gi, '')
                filteredMessage = filteredMessage.replace(/\(\s*\$?[\d,]+\.\d+\s+[A-Z]{3}\s+platform fee\s+deducted\s*\)/gi, '')
              }
              if (isSeller && !isBuyer) {
                // Remove buyer fee details for sellers
                filteredMessage = filteredMessage.replace(/\(\s*\$?[\d,]+\.\d+\s+[A-Z]{3}\s+fee\s+included\s*\)/gi, '')
                filteredMessage = filteredMessage.replace(/\(\s*\$?[\d,]+\.\d+\s+[A-Z]{3}\s+processing fee\s*\(3%\)\s*\)/gi, '')
                filteredMessage = filteredMessage.replace(/\s+processing fee[^.]*/gi, '')
              }
              filteredMessage = filteredMessage.replace(/\s+/g, ' ').trim()
              filteredMessage = filteredMessage.replace(/\s*\(\s*\)/g, '')
              filteredMessage = filteredMessage.replace(/\s*\.\s*\./g, '.')
              filteredMessage = filteredMessage.replace(/^\s*\.\s*/g, '')
              
              return (
                <View key={event.id}>
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineMessage}>{filteredMessage}</Text>
                      <Text style={styles.timelineDate}>
                        {new Date(event.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  {index < rift.timelineEvents!.length - 1 && <View style={styles.timelineConnector} />}
                </View>
              )
            })}
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

