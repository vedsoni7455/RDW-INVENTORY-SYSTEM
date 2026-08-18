export const theme = {
  colors: {
    // Deep Space & Glass Backgrounds
    bgBase: '#060911',
    bgDark: '#090d16',
    bgHeader: '#0b111e',
    surfaceCard: '#111928',
    surfaceCardHover: '#162238',
    surfaceCardGlass: 'rgba(17, 25, 40, 0.85)',
    surfaceSubtle: '#0d1422',
    
    // Border system
    borderSubtle: '#1b273d',
    borderLight: '#263857',
    borderGlow: 'rgba(0, 242, 254, 0.25)',
    borderGlowGreen: 'rgba(16, 185, 129, 0.3)',
    borderGlowAmber: 'rgba(245, 158, 11, 0.3)',
    borderGlowRed: 'rgba(239, 68, 68, 0.3)',
    
    // Typography
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textWhite: '#ffffff',
    
    // Accent Palettes
    accentCyan: '#00f2fe',
    accentCyanLight: '#38bdf8',
    accentBlue: '#3b82f6',
    accentEmerald: '#10b981',
    accentEmeraldLight: '#34d399',
    accentAmber: '#f59e0b',
    accentAmberLight: '#fbbf24',
    accentRed: '#ef4444',
    accentRedLight: '#f87171',
    accentPurple: '#a855f7',
    accentIndigo: '#6366f1',
    
    // Glow and Translucent Overlays
    glowCyan: 'rgba(0, 242, 254, 0.15)',
    glowEmerald: 'rgba(16, 185, 129, 0.15)',
    glowAmber: 'rgba(245, 158, 11, 0.15)',
    glowRed: 'rgba(239, 68, 68, 0.15)',
    glowPurple: 'rgba(168, 85, 247, 0.15)',
  },
  shadows: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    glowCyan: {
      shadowColor: '#00f2fe',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5,
    },
    glowEmerald: {
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5,
    },
  },
  borderRadius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    full: 9999,
  },
};
