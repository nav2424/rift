// Enterprise Design System - Billion Dollar Fintech Standards

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Typography = {
  // Titles
  title: {
    fontSize: 36,
    fontWeight: '600' as const,
    letterSpacing: 0.36, // +1% of 36
    lineHeight: 44,
  },
  // Subtitles
  subtitle: {
    fontSize: 17,
    fontWeight: '400' as const,
    opacity: 0.7, // 70% - the sweet spot
    lineHeight: 24,
  },
  // Body text
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    opacity: 0.75, // 75-80% opacity
    lineHeight: 22,
  },
  // Button text
  button: {
    fontSize: 17,
    fontWeight: '500' as const,
  },
  // Section titles
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  // Subsection descriptions
  subsection: {
    fontSize: 14,
    fontWeight: '400' as const,
    opacity: 0.65,
    lineHeight: 20,
  },
} as const;

export const BorderRadius = {
  card: 20,
  button: 14,
  input: 16,
} as const;

export const Motion = {
  duration: 120, // 90-150ms range
  easing: 'ease-out',
} as const;

