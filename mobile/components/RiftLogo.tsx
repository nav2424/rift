import React from 'react';
import { Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';

interface RiftLogoProps {
  size?: number;
  style?: ViewStyle | ImageStyle;
}

export default function RiftLogo({ size = 80, style }: RiftLogoProps) {
  return (
    <Image
      source={require('../assets/rift-logo.png')}
      style={[styles.logo, { width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    // Image will be sized by width/height props
  },
});

