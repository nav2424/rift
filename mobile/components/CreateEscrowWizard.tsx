import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, User } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import PremiumGlassCard from './PremiumGlassCard';
import GlassButton from './GlassButton';
import { Colors } from '@/constants/Colors';
import { Spacing, Typography, BorderRadius } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface CreateEscrowWizardProps {
  users: User[];
  itemType: 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES';
  onBack: () => void;
}

type Step = 'role' | 'basic' | 'details' | 'partner' | 'review';
type CreatorRole = 'BUYER' | 'SELLER' | null;

// Currency list with codes and names
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'RON', name: 'Romanian Leu' },
];

export default function CreateEscrowWizard({ users, itemType, onBack }: CreateEscrowWizardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('role');
  const [loading, setLoading] = useState(false);
  const [creatorRole, setCreatorRole] = useState<CreatorRole>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [formData, setFormData] = useState({
    itemTitle: '',
    itemDescription: '',
    amount: '',
    currency: 'CAD',
    partnerId: '', // Can be buyerId or sellerId depending on creator role
    partnerEmail: '', // Can be buyerEmail or sellerEmail
    shippingAddress: '',
    notes: '',
    eventDate: '',
    venue: '',
    transferMethod: '',
    downloadLink: '',
    licenseKey: '',
    serviceDate: '',
  });
  const [selectedDate, setSelectedDate] = useState(new Date());

  const steps: Step[] = ['role', 'basic', 'details', 'partner', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      updateFormData('eventDate', formattedDate);
    }
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const selectCurrency = (currencyCode: string) => {
    updateFormData('currency', currencyCode);
    setShowCurrencyPicker(false);
  };

  const validateStep = (step: Step): boolean => {
    switch (step) {
      case 'role':
        return creatorRole !== null;
      case 'basic':
        return !!(formData.itemTitle && formData.itemDescription && formData.amount);
      case 'details':
        if (itemType === 'PHYSICAL') return !!formData.shippingAddress;
        if (itemType === 'TICKETS') return !!(formData.eventDate && formData.venue && formData.transferMethod);
        if (itemType === 'DIGITAL') return !!formData.downloadLink;
        if (itemType === 'SERVICES') return !!formData.serviceDate;
        return true;
      case 'partner':
        return !!(formData.partnerId || formData.partnerEmail);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      Alert.alert('Incomplete', 'Please fill in all required fields');
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    } else {
      onBack();
    }
  };

  const handleSubmit = async () => {
    // Verify user is authenticated
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to create a rift', [
        { text: 'OK', onPress: () => router.push('/(auth)/signin') }
      ]);
      return;
    }

    setLoading(true);
    try {
      // Verify token is still valid by checking current user
      try {
        await api.getCurrentUser();
      } catch (authError: any) {
        if (authError.message === 'Unauthorized') {
          Alert.alert('Session Expired', 'Please sign in again', [
            { text: 'OK', onPress: () => router.push('/(auth)/signin') }
          ]);
          setLoading(false);
          return;
        }
      }
      const payload: any = {
        itemTitle: formData.itemTitle,
        itemDescription: formData.itemDescription,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        itemType,
        creatorRole, // 'BUYER' or 'SELLER'
        partnerId: formData.partnerId || undefined,
        partnerEmail: formData.partnerEmail || undefined,
        notes: formData.notes || undefined,
      };
      
      // For backward compatibility, also include sellerId/sellerEmail if creator is buyer
      if (creatorRole === 'BUYER') {
        payload.sellerId = formData.partnerId || undefined;
        payload.sellerEmail = formData.partnerEmail || undefined;
      } else if (creatorRole === 'SELLER') {
        payload.buyerId = formData.partnerId || undefined;
        payload.buyerEmail = formData.partnerEmail || undefined;
      }

      if (itemType === 'PHYSICAL') {
        payload.shippingAddress = formData.shippingAddress;
      } else if (itemType === 'TICKETS') {
        payload.eventDate = formData.eventDate;
        payload.venue = formData.venue;
        payload.transferMethod = formData.transferMethod;
      } else if (itemType === 'DIGITAL') {
        payload.downloadLink = formData.downloadLink;
        payload.licenseKey = formData.licenseKey || undefined;
      } else if (itemType === 'SERVICES') {
        payload.serviceDate = formData.serviceDate;
      }

      const result = await api.createEscrow(payload);
      router.push(`/escrows/${result.escrowId}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create rift');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              index <= currentStepIndex && styles.stepDotActive,
            ]}
          />
          {index < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                index < currentStepIndex && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderRoleStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerSection}>
        <View style={styles.headerIconContainer}>
          <View style={styles.headerIconShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="person-outline" size={28} color={Colors.text} />
        </View>
        <Text style={styles.stepTitle}>Your Role</Text>
        <Text style={styles.stepSubtitle}>Are you buying or selling?</Text>
      </View>

      <PremiumGlassCard variant="premium" style={styles.formCard}>
        <TouchableOpacity
          style={[
            styles.roleOption,
            creatorRole === 'BUYER' && styles.roleOptionActive,
          ]}
          onPress={() => setCreatorRole('BUYER')}
          activeOpacity={0.7}
        >
          <View style={styles.roleOptionContent}>
            <View style={[
              styles.radioButton,
              creatorRole === 'BUYER' && styles.radioButtonActive
            ]}>
              {creatorRole === 'BUYER' && (
                <View style={styles.radioButtonInner} />
              )}
            </View>
            <View style={styles.roleOptionTextContainer}>
              <Text style={[
                styles.roleOptionTitle,
                creatorRole === 'BUYER' && styles.roleOptionTitleActive
              ]}>
                I'm the Buyer
              </Text>
              <Text style={[
                styles.roleOptionSubtitle,
                creatorRole === 'BUYER' && styles.roleOptionSubtitleActive
              ]}>
                I'm purchasing this item. I'll select the seller.
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleOption,
            creatorRole === 'SELLER' && styles.roleOptionActive,
            { marginTop: 16 }
          ]}
          onPress={() => setCreatorRole('SELLER')}
          activeOpacity={0.7}
        >
          <View style={styles.roleOptionContent}>
            <View style={[
              styles.radioButton,
              creatorRole === 'SELLER' && styles.radioButtonActive
            ]}>
              {creatorRole === 'SELLER' && (
                <View style={styles.radioButtonInner} />
              )}
            </View>
            <View style={styles.roleOptionTextContainer}>
              <Text style={[
                styles.roleOptionTitle,
                creatorRole === 'SELLER' && styles.roleOptionTitleActive
              ]}>
                I'm the Seller
              </Text>
              <Text style={[
                styles.roleOptionSubtitle,
                creatorRole === 'SELLER' && styles.roleOptionSubtitleActive
              ]}>
                I'm selling this item. I'll select the buyer.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </PremiumGlassCard>
    </View>
  );

  const renderBasicStep = () => (
    <View style={styles.stepContainer}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerIconContainer}>
          <View style={styles.headerIconShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="document-text" size={28} color={Colors.text} />
        </View>
        <Text style={styles.stepTitle}>Basic Information</Text>
        <Text style={styles.stepSubtitle}>Tell us about the item you're protecting</Text>
      </View>

      {/* Form Card */}
      <PremiumGlassCard variant="premium" style={styles.formCard}>
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="pricetag-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.label}>Item Title</Text>
            <Text style={styles.required}>*</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g., iPhone 15 Pro Max"
              placeholderTextColor={Colors.textTertiary}
              value={formData.itemTitle}
              onChangeText={(v) => updateFormData('itemTitle', v)}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.label}>Description</Text>
            <Text style={styles.required}>*</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the item in detail..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.itemDescription}
              onChangeText={(v) => updateFormData('itemDescription', v)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                value={formData.amount}
                onChangeText={(v) => {
                  // Only allow numbers and decimal point
                  const numericValue = v.replace(/[^0-9.]/g, '');
                  // Ensure only one decimal point
                  const parts = numericValue.split('.');
                  const filteredValue = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : numericValue;
                  updateFormData('amount', filteredValue);
                }}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
              <View style={[styles.inputGroup, { flex: 0.5 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="globe-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.label}>Currency</Text>
            </View>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowCurrencyPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.currencyText, !formData.currency && styles.currencyPlaceholder]}>
                {formData.currency || 'Select currency'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </PremiumGlassCard>
    </View>
  );

  const renderDetailsStep = () => {
    if (itemType === 'PHYSICAL') {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.headerSection}>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIconShadow} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="cube-outline" size={28} color={Colors.text} />
            </View>
            <Text style={styles.stepTitle}>Shipping Details</Text>
            <Text style={styles.stepSubtitle}>Where should this be delivered?</Text>
          </View>

          <PremiumGlassCard variant="premium" style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.label}>Shipping Address</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter full shipping address..."
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.shippingAddress}
                  onChangeText={(v) => updateFormData('shippingAddress', v)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </PremiumGlassCard>
        </View>
      );
    }

    if (itemType === 'TICKETS') {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.headerSection}>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIconShadow} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="ticket-outline" size={28} color={Colors.text} />
            </View>
            <Text style={styles.stepTitle}>Event Details</Text>
            <Text style={styles.stepSubtitle}>When and where is the event?</Text>
          </View>

          <PremiumGlassCard variant="premium" style={styles.formCard}>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <View style={styles.labelRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.label}>Event Date</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    // If there's already a date, parse it; otherwise use today
                    if (formData.eventDate) {
                      const parsed = new Date(formData.eventDate);
                      if (!isNaN(parsed.getTime())) {
                        setSelectedDate(parsed);
                      }
                    }
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, !formData.eventDate && styles.datePlaceholder]}>
                    {formData.eventDate ? formatDateDisplay(formData.eventDate) : 'Select event date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <View style={styles.labelRow}>
                  <Ionicons name="business-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.label}>Venue</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Venue name"
                    placeholderTextColor={Colors.textTertiary}
                    value={formData.venue}
                    onChangeText={(v) => updateFormData('venue', v)}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="swap-horizontal-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.label}>Transfer Method</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Email, Mobile App"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.transferMethod}
                  onChangeText={(v) => updateFormData('transferMethod', v)}
                />
              </View>
            </View>
          </PremiumGlassCard>
        </View>
      );
    }

    if (itemType === 'DIGITAL') {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.headerSection}>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIconShadow} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="download-outline" size={28} color={Colors.text} />
            </View>
            <Text style={styles.stepTitle}>Digital Delivery</Text>
            <Text style={styles.stepSubtitle}>How will the buyer access this?</Text>
          </View>

          <PremiumGlassCard variant="premium" style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="link-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.label}>Download Link</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.downloadLink}
                  onChangeText={(v) => updateFormData('downloadLink', v)}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="key-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.label}>License Key (optional)</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter license key if applicable"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.licenseKey}
                  onChangeText={(v) => updateFormData('licenseKey', v)}
                />
              </View>
            </View>
          </PremiumGlassCard>
        </View>
      );
    }

    if (itemType === 'SERVICES') {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.headerSection}>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIconShadow} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="construct-outline" size={28} color={Colors.text} />
            </View>
            <Text style={styles.stepTitle}>Service Details</Text>
            <Text style={styles.stepSubtitle}>When will this service be provided?</Text>
          </View>

          <PremiumGlassCard variant="premium" style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.label}>Service Date / Timeline</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., January 15, 2024 or Within 2 weeks"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.serviceDate}
                  onChangeText={(v) => updateFormData('serviceDate', v)}
                />
              </View>
            </View>
          </PremiumGlassCard>
        </View>
      );
    }

    return null;
  };

  const renderPartnerStep = () => {
    const isBuyer = creatorRole === 'BUYER';
    const partnerLabel = isBuyer ? 'Seller' : 'Buyer';
    const partnerSubtitle = isBuyer 
      ? "You're the buyer. Select who you're buying from (the seller)"
      : "You're the seller. Select who you're selling to (the buyer)";

    // Filter out current user from the list
    const availableUsers = users.filter((u) => u.id !== user?.id);

    return (
      <View style={styles.stepContainer}>
        <View style={styles.headerSection}>
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIconShadow} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="person-outline" size={28} color={Colors.text} />
          </View>
          <Text style={styles.stepTitle}>Transaction Partner</Text>
          <Text style={styles.stepSubtitle}>{partnerSubtitle}</Text>
        </View>

        <PremiumGlassCard variant="premium" style={styles.formCard}>
          {availableUsers.length > 0 && (
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.label}>Select {partnerLabel}</Text>
              </View>
            <View style={styles.userList}>
              {availableUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.userOption,
                    formData.partnerId === user.id && styles.userOptionActive,
                  ]}
                  onPress={() => {
                    updateFormData('partnerId', user.id);
                    updateFormData('partnerEmail', '');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.userOptionContent}>
                    <View style={[
                      styles.radioButton,
                      formData.partnerId === user.id && styles.radioButtonActive
                    ]}>
                      {formData.partnerId === user.id && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.userOptionText,
                        formData.partnerId === user.id && styles.userOptionTextActive,
                      ]}
                    >
                      {user.name || user.email}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.label}>{partnerLabel} Email</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={`${partnerLabel.toLowerCase()}@example.com`}
              placeholderTextColor={Colors.textTertiary}
              value={formData.partnerEmail}
              onChangeText={(v) => {
                updateFormData('partnerEmail', v);
                updateFormData('partnerId', '');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.label}>Additional Notes (optional)</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any additional information..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.notes}
              onChangeText={(v) => updateFormData('notes', v)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      </PremiumGlassCard>
    </View>
    );
  };

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerSection}>
        <View style={styles.headerIconContainer}>
          <View style={styles.headerIconShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="checkmark-circle-outline" size={28} color={Colors.text} />
        </View>
        <Text style={styles.stepTitle}>Review & Confirm</Text>
        <Text style={styles.stepSubtitle}>Please review before creating</Text>
      </View>

      <PremiumGlassCard variant="premium" style={styles.formCard}>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Item</Text>
          <Text style={styles.reviewValue}>{formData.itemTitle}</Text>
        </View>

        <View style={styles.reviewDivider} />

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Amount</Text>
          <Text style={styles.reviewValue}>
            {formData.currency} {formData.amount}
          </Text>
        </View>

        <View style={styles.reviewDivider} />

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>{creatorRole === 'BUYER' ? 'Seller' : 'Buyer'}</Text>
          <Text style={styles.reviewValue}>
            {formData.partnerId
              ? users.find((u) => u.id === formData.partnerId)?.name ||
                users.find((u) => u.id === formData.partnerId)?.email
              : formData.partnerEmail || 'Not specified'}
          </Text>
        </View>
      </PremiumGlassCard>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['#0C0C0C', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}

        {currentStep === 'role' && renderRoleStep()}
        {currentStep === 'basic' && renderBasicStep()}
        {currentStep === 'details' && renderDetailsStep()}
        {currentStep === 'partner' && renderPartnerStep()}
        {currentStep === 'review' && renderReviewStep()}

        {/* Currency Picker Modal */}
        <Modal
          visible={showCurrencyPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCurrencyPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Currency</Text>
                <TouchableOpacity
                  onPress={() => setShowCurrencyPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={CURRENCIES}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.currencyItem,
                      formData.currency === item.code && styles.currencyItemActive,
                    ]}
                    onPress={() => selectCurrency(item.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.currencyItemCode,
                      formData.currency === item.code && styles.currencyItemCodeActive,
                    ]}>
                      {item.code}
                    </Text>
                    <Text style={[
                      styles.currencyItemName,
                      formData.currency === item.code && styles.currencyItemNameActive,
                    ]}>
                      {item.name}
                    </Text>
                    {formData.currency === item.code && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.text} />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.currencyList}
              />
            </View>
          </View>
        </Modal>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.modalTitle}>Select Event Date</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  textColor={Colors.text}
                />
              ) : (
                <View style={styles.androidDatePickerContainer}>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={prevStep}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          {currentStep === 'review' ? (
            <GlassButton
              title={loading ? 'Creating...' : 'Create Rift'}
              onPress={handleSubmit}
              variant="primary"
              size="lg"
              disabled={loading}
              loading={loading}
              style={{ flex: 1, marginLeft: 12 }}
            />
          ) : (
            <GlassButton
              title="Continue"
              onPress={nextStep}
              variant="primary"
              size="lg"
              style={{ flex: 1, marginLeft: 12 }}
            />
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  headerBackButton: {
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
    padding: Spacing.xl + 4,
    paddingBottom: 120,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  stepDotActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  stepContainer: {
    marginBottom: 24,
  },
  headerSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerIconShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 36,
  },
  stepSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 20,
    opacity: 0.7,
    lineHeight: 22,
  },
  formCard: {
    padding: Spacing.xl + 6,
    marginTop: 12,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  inputGroup: {
    marginBottom: 28,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 0.2,
    opacity: 0.9,
  },
  required: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 2,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 18,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  amountInput: {
    paddingLeft: 28,
  },
  currencySymbol: {
    position: 'absolute',
    left: 16,
    top: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
    zIndex: 1,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 18,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  userList: {
    marginBottom: 16,
  },
  roleOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: Spacing.xl + 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  roleOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  roleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  roleOptionTextContainer: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  roleOptionTitleActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  roleOptionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    opacity: 0.7,
  },
  roleOptionSubtitleActive: {
    color: Colors.textSecondary,
    opacity: 0.9,
  },
  userOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: Spacing.lg + 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  userOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  userOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  radioButtonActive: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  userOptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
    flex: 1,
  },
  userOptionTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  orText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 20,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  reviewValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  dateText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400',
    flex: 1,
  },
  datePlaceholder: {
    color: Colors.textTertiary,
  },
  datePickerModalContent: {
    backgroundColor: '#0C0C0C',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '50%',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl + 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  androidDatePickerContainer: {
    padding: Spacing.xl + 4,
    alignItems: 'center',
  },
  datePickerButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  datePickerButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  currencyText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400',
    flex: 1,
  },
  currencyPlaceholder: {
    color: Colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0C0C0C',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl + 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  currencyList: {
    maxHeight: 400,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg + 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  currencyItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
  },
  currencyItemCode: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    width: 60,
    letterSpacing: 0.5,
  },
  currencyItemCodeActive: {
    color: Colors.text,
  },
  currencyItemName: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
    marginLeft: Spacing.md,
  },
  currencyItemNameActive: {
    color: Colors.text,
    opacity: 0.9,
  },
});
