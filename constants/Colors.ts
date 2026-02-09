/**
 * Cashplit Mobile App Color Theme
 * Matching the web design: dark theme with green accent
 */

const primaryGreen = '#13ec6d';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: primaryGreen,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryGreen,
  },
  dark: {
    // Main colors
    background: '#0D0D0D',
    backgroundGradientStart: '#0D0D0D',
    backgroundGradientEnd: '#1A1A1A',
    card: '#121212',
    cardHover: '#1A1A1A',

    // Text colors
    text: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    textMuted: 'rgba(255, 255, 255, 0.4)',

    // Primary accent
    tint: primaryGreen,
    primary: primaryGreen,
    primaryFaded: 'rgba(19, 236, 109, 0.2)',
    primaryGlow: 'rgba(19, 236, 109, 0.3)',

    // Status colors
    success: primaryGreen,
    danger: '#EF4444',
    dangerFaded: 'rgba(239, 68, 68, 0.2)',
    warning: '#FFBB28',

    // Borders
    border: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.05)',

    // Tab bar
    tabIconDefault: 'rgba(255, 255, 255, 0.4)',
    tabIconSelected: primaryGreen,
    icon: 'rgba(255, 255, 255, 0.6)',
  },
};
