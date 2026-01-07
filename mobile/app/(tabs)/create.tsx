import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api, User } from '@/lib/api';
import CreateEscrowWizard from '@/components/CreateEscrowWizard';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export default function CreateEscrowScreen() {
  const [itemType, setItemType] = useState<'SERVICES' | 'OWNERSHIP_TRANSFER' | 'DIGITAL_GOODS' | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    }
  };

  if (!itemType) {
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
          {/* SECTION 1: Hero Header */}
          <View style={styles.heroSection}>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Create a Rift</Text>
              <Text style={styles.heroSubtitle}>Start a protected transaction</Text>
              <Text style={styles.trustText}>Funds are released only when delivery is confirmed.</Text>
            </View>
          </View>

          {/* SECTION 2: Category Cards - Full Width */}
          <View style={styles.typeCardsContainer}>
            {[
              { 
                type: 'SERVICES', 
                label: 'Service', 
                description: 'Consulting, freelance work, professional services',
                icon: 'construct' as const, 
              },
              { 
                type: 'OWNERSHIP_TRANSFER', 
                label: 'Ownership Transfer', 
                description: 'Domains, websites, social accounts, online businesses',
                icon: 'swap-horizontal' as const, 
              },
              { 
                type: 'DIGITAL_GOODS', 
                label: 'Digital Goods', 
                description: 'Software, licenses, downloads, and digital assets',
                icon: 'download' as const, 
              },
            ].map((item, index) => (
              <TouchableOpacity
                key={item.type}
                style={styles.typeCard}
                onPress={() => setItemType(item.type as any)}
                activeOpacity={0.92}
              >
                <View style={styles.typeCardShadow} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.typeCardContent}>
                  <View style={styles.typeCardLeft}>
                    <View style={styles.typeIconContainer}>
                      <Ionicons name={item.icon} size={32} color={Colors.text} />
                    </View>
                    <View style={styles.typeTextContainer}>
                      <Text style={styles.typeLabel}>{item.label}</Text>
                      <Text style={styles.typeDescription}>{item.description}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

        </ScrollView>
      </View>
    );
  }

  return (
    <CreateEscrowWizard 
      users={users} 
      itemType={itemType} 
      onBack={() => setItemType(null)} 
    />
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
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 80 : Spacing.xxl + 8,
    paddingHorizontal: Spacing.xl + 4,
    paddingBottom: Spacing.xl + 8,
  },
  heroContent: {
    width: '100%',
  },
  heroTitle: {
    fontSize: 32,
    color: Colors.text,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginBottom: Spacing.xs + 2,
    lineHeight: 40,
  },
  heroSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.65,
    lineHeight: 22,
    letterSpacing: 0,
    marginBottom: Spacing.xs,
  },
  trustText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.5,
    lineHeight: 20,
    letterSpacing: 0,
  },
  typeCardsContainer: {
    paddingHorizontal: Spacing.xl + 4,
    gap: Spacing.lg + 4,
    marginBottom: Spacing.xxl + 12,
  },
  typeCard: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
    minHeight: 100,
  },
  typeCardShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  typeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl + 6,
    position: 'relative',
    zIndex: 1,
  },
  typeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg + 4,
    flex: 1,
  },
  typeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  typeTextContainer: {
    flex: 1,
    gap: Spacing.xs + 2,
  },
  typeLabel: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 2,
  },
  typeDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.7,
    lineHeight: 22,
  },
});
