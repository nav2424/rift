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
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, User } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';

interface CreateEscrowFormProps {
  users: User[];
  itemType: 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES';
}

export default function CreateEscrowForm({ users, itemType }: CreateEscrowFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Filter out current user from the list
  const availableUsers = users.filter((u) => u.id !== user?.id);
  const [formData, setFormData] = useState({
    itemTitle: '',
    itemDescription: '',
    amount: '',
    currency: 'CAD',
    sellerId: '',
    sellerEmail: '',
    shippingAddress: '',
    notes: '',
    eventDate: '',
    venue: '',
    transferMethod: '',
    downloadLink: '',
    licenseKey: '',
    serviceDate: '',
  });

  const handleSubmit = async () => {
    if (!formData.itemTitle || !formData.itemDescription || !formData.amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.sellerId && !formData.sellerEmail) {
      Alert.alert('Error', 'Please select or enter a seller');
      return;
    }

    // Type-specific validation
    if (itemType === 'PHYSICAL' && !formData.shippingAddress) {
      Alert.alert('Error', 'Shipping address is required for physical items');
      return;
    }
    if (itemType === 'TICKETS' && (!formData.eventDate || !formData.venue || !formData.transferMethod)) {
      Alert.alert('Error', 'Event date, venue, and transfer method are required for tickets');
      return;
    }
    if (itemType === 'DIGITAL' && !formData.downloadLink) {
      Alert.alert('Error', 'Download link is required for digital items');
      return;
    }
    if (itemType === 'SERVICES' && !formData.serviceDate) {
      Alert.alert('Error', 'Service date is required for services');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        itemTitle: formData.itemTitle,
        itemDescription: formData.itemDescription,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        itemType,
        sellerId: formData.sellerId || undefined,
        sellerEmail: formData.sellerEmail || undefined,
        notes: formData.notes || undefined,
      };

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard variant="liquid" style={styles.formCard}>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Item Title *</Text>
              <TextInput
                style={styles.input}
                placeholder={
                  itemType === 'PHYSICAL' ? 'e.g., iPhone 13 Pro' :
                  itemType === 'TICKETS' ? 'e.g., Taylor Swift Concert Tickets' :
                  itemType === 'DIGITAL' ? 'e.g., Premium Software License' :
                  'e.g., Web Development Service'
                }
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={formData.itemTitle}
                onChangeText={(text) => setFormData({ ...formData, itemTitle: text })}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the item..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={formData.itemDescription}
                onChangeText={(text) => setFormData({ ...formData, itemDescription: text })}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfInput]}>
                <Text style={styles.inputLabel}>Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputContainer, styles.halfInput]}>
                <Text style={styles.inputLabel}>Currency</Text>
                <TextInput
                  style={styles.input}
                  placeholder="CAD"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={formData.currency}
                  onChangeText={(text) => setFormData({ ...formData, currency: text })}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Seller *</Text>
              {availableUsers.length > 0 && (
                <View style={styles.selectContainer}>
                  {availableUsers.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.selectOption,
                        formData.sellerId === user.id && styles.selectOptionActive,
                      ]}
                      onPress={() => setFormData({ ...formData, sellerId: user.id, sellerEmail: '' })}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          formData.sellerId === user.id && styles.selectOptionTextActive,
                        ]}
                      >
                        {user.name || user.email}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={styles.orText}>OR</Text>
              <TextInput
                style={styles.input}
                placeholder="Seller Email"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={formData.sellerEmail}
                onChangeText={(text) => setFormData({ ...formData, sellerEmail: text, sellerId: '' })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {itemType === 'PHYSICAL' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Shipping Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Your shipping address..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={formData.shippingAddress}
                  onChangeText={(text) => setFormData({ ...formData, shippingAddress: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            {itemType === 'TICKETS' && (
              <>
                <View style={styles.row}>
                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Text style={styles.inputLabel}>Event Date *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      value={formData.eventDate}
                      onChangeText={(text) => setFormData({ ...formData, eventDate: text })}
                    />
                  </View>
                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Text style={styles.inputLabel}>Venue *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Rogers Centre"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      value={formData.venue}
                      onChangeText={(text) => setFormData({ ...formData, venue: text })}
                    />
                  </View>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Transfer Method *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Email Transfer, Mobile App"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={formData.transferMethod}
                    onChangeText={(text) => setFormData({ ...formData, transferMethod: text })}
                  />
                </View>
              </>
            )}

            {itemType === 'DIGITAL' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Download Link *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={formData.downloadLink}
                    onChangeText={(text) => setFormData({ ...formData, downloadLink: text })}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>License Key (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter license key..."
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={formData.licenseKey}
                    onChangeText={(text) => setFormData({ ...formData, licenseKey: text })}
                  />
                </View>
              </>
            )}

            {itemType === 'SERVICES' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Service Date / Timeline *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., January 15, 2024 or Within 2 weeks"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={formData.serviceDate}
                  onChangeText={(text) => setFormData({ ...formData, serviceDate: text })}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                multiline
                numberOfLines={2}
              />
            </View>

            <GlassButton
              title={loading ? 'Creating...' : 'Create Rift'}
              onPress={handleSubmit}
              variant="primary"
              size="lg"
              disabled={loading}
              loading={loading}
              style={styles.button}
            />
          </View>
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: 20,
    paddingBottom: 120,
  },
  formCard: {
    padding: 24,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  selectContainer: {
    marginBottom: 12,
  },
  selectOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  selectOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: '#ffffff',
  },
  selectOptionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '400',
  },
  selectOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  button: {
    marginTop: 8,
  },
});
