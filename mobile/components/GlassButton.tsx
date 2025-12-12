import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography, BorderRadius, Spacing, Motion } from '@/constants/DesignSystem';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function GlassButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: GlassButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[size],
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.99} // 1% scale feedback only
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' ? Colors.text : '#ffffff'} 
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.button, // 14px
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    // Motion: 120ms ease-out
    transition: `all ${Motion.duration}ms ${Motion.easing}`,
  },
  primary: {
    backgroundColor: Colors.background,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondary: {
    backgroundColor: Colors.glassStrong,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.glassBorder,
  },
  sm: {
    paddingVertical: Spacing.md, // 12px
    paddingHorizontal: Spacing.xl, // 24px
  },
  md: {
    paddingVertical: Spacing.lg, // 16px
    paddingHorizontal: Spacing.xl, // 24px
  },
  lg: {
    paddingVertical: Spacing.lg, // 16px - less bulky
    paddingHorizontal: Spacing.xl, // 24px - less bulky
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...Typography.button, // 17pt, Medium (500)
  },
  primaryText: {
    color: Colors.text,
  },
  secondaryText: {
    color: Colors.text,
  },
  outlineText: {
    color: Colors.text,
  },
  smText: {
    ...Typography.button,
  },
  mdText: {
    ...Typography.button,
  },
  lgText: {
    ...Typography.button,
  },
});

