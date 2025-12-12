import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/DesignSystem';

interface PremiumGlassCardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: 'default' | 'strong' | 'light' | 'premium';
  style?: ViewStyle;
  onPress?: () => void;
  gradient?: boolean;
}

export default function PremiumGlassCard({ 
  children, 
  variant = 'default',
  style,
  onPress,
  gradient = false,
  ...props 
}: PremiumGlassCardProps) {
  const cardContent = (
    <View style={[styles.base, styles[variant], style]}>
      {/* Subtle gradient from top-left to bottom-right */}
      <LinearGradient
        colors={['rgba(17, 17, 17, 0.6)', 'rgba(11, 11, 11, 0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity 
        activeOpacity={0.95} // Darken by 5% only
        onPress={onPress}
        style={styles.touchable}
        {...props}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: Spacing.xl, // 24px between stacked cards
  },
  base: {
    borderRadius: BorderRadius.card, // 20px
    overflow: 'hidden',
    borderWidth: 0.5, // Ultra-thin
    position: 'relative',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  default: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  strong: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  light: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  premium: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});

