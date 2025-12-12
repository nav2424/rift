import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [disputes, setDisputes] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDisputes();
    }
  }, [user]);

  const loadDisputes = async () => {
    try {
      const data = await api.getUserDisputes();
      setDisputes(data);
    } catch (error) {
      // Silently fail - disputes are optional
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(tabs)/dashboard');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0C0C0C', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* SECTION 1: Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Account</Text>
          <Text style={styles.headerSubtitle}>Profile & support</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 2: Profile Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sectionCardContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={18} color={Colors.text} />
              <Text style={styles.sectionTitle}>Profile</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{user?.name || 'Not set'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{user?.email}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Phone</Text>
              <Text style={styles.profileValue}>{user?.phone || 'Not set'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push('/account/edit-profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 3: Disputes */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sectionCardContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={18} color={Colors.text} />
              <Text style={styles.sectionTitle}>Your Disputes</Text>
            </View>
            <TouchableOpacity 
              style={styles.disputeRow}
              onPress={() => router.push('/account/disputes')}
              activeOpacity={0.8}
            >
              <View style={styles.disputeInfo}>
                <Text style={styles.disputeLabel}>View any active or resolved disputes</Text>
                {disputes.length > 0 && (
                  <Text style={styles.disputeCount}>{disputes.length} active</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 4: Support & Help Center */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardShadow} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sectionCardContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle" size={18} color={Colors.text} />
              <Text style={styles.sectionTitle}>Support & Help Center</Text>
            </View>
            <TouchableOpacity 
              style={styles.supportRow}
              onPress={() => router.push('/account/support?type=faq')}
              activeOpacity={0.8}
            >
              <Text style={styles.supportLabel}>FAQ</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.supportRow}
              onPress={() => router.push('/account/support?type=contact')}
              activeOpacity={0.8}
            >
              <Text style={styles.supportLabel}>Contact Support</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.supportRow}
              onPress={() => router.push('/account/support?type=report')}
              activeOpacity={0.8}
            >
              <Text style={styles.supportLabel}>Report a problem</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Section */}
        {user?.role === 'ADMIN' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardShadow} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.sectionCardContent}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Admin</Text>
              </View>
              <TouchableOpacity 
                style={styles.adminRow}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <Text style={styles.adminLabel}>Admin Dashboard</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
  headerContent: {
    width: '100%',
  },
  headerTitle: {
    fontSize: 32,
    color: Colors.text,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginBottom: Spacing.xs + 2,
    lineHeight: 40,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '400',
    opacity: 0.65,
    lineHeight: 22,
    letterSpacing: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl + 4,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },
  sectionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    marginBottom: Spacing.lg + 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  sectionCardShadow: {
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
  sectionCardContent: {
    padding: Spacing.xl,
    position: 'relative',
    zIndex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '300',
    letterSpacing: -0.4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileLabel: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  profileValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '300',
  },
  editButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  editButtonText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '300',
  },
  disputeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  disputeInfo: {
    flex: 1,
  },
  disputeLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400',
    marginBottom: 4,
  },
  disputeCount: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '300',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  adminLabel: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '300',
  },
  signOutButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  signOutText: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '300',
  },
  supportLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400',
  },
});
