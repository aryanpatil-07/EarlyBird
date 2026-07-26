/**
 * Design System Tokens
 * 
 * Generated from ui-ux-pro-max framework for fintech fraud detection.
 * Design Dials: Motion 5/10 (Standard) | Density 7/10 (Standard)
 * 
 * Color Strategy:
 * - Amber (#F59E0B) Primary: Gold trust signal + professional confidence
 * - Purple (#8B5CF6) Accent/CTA: Tech innovation + action emphasis
 * - Dark Navy (#0F172A) Background: OLED-optimized, eye-friendly
 * - Secondary Amber (#FBBF24) highlight for secondary actions
 */

export const theme = {
  colors: {
    // Primary palette (Amber) - trust, navigation, emphasis
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primaryDark: '#D97706',
    
    // On Primary (contrast) - text on amber backgrounds
    onPrimary: '#0F172A',

    // Secondary palette (Amber lighter) - secondary emphasis
    secondary: '#FBBF24',
    secondaryDark: '#F59E0B',

    // Accent palette (Purple) - CTAs, primary actions
    accent: '#8B5CF6',
    accentLight: '#A78BFA',
    accentDark: '#7C3AED',

    // Background and surfaces
    background: '#0F172A',
    backgroundAlt: '#1E293B',
    backgroundMuted: '#272F42',
    
    // Foreground and text
    foreground: '#F8FAFC',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',

    // Semantic colors
    muted: '#272F42',
    border: '#334155',
    destructive: '#EF4444',
    destructiveLight: '#FCA5A5',
    destructiveDark: '#991B1B',
    success: '#10B981',
    successLight: '#D1FAE5',
    successDark: '#047857',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    warningDark: '#B45309',
    
    // Ring (focus state)
    ring: '#F59E0B',

    // Legacy light mode support (for reference)
    light: {
      bg: '#FFFFFF',
      bgAlt: '#F9FAFB',
      bgMuted: '#F3F4F6',
      border: '#E5E7EB',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#6B7280',
    },
  },

  typography: {
    // Primary typography: IBM Plex Sans (fintech standard)
    heading: "'IBM Plex Sans', 'Inter', system-ui, -apple-system, sans-serif",
    body: "'IBM Plex Sans', 'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace",

    // Font sizes with line heights
    sizes: {
      h1: { size: '32px', weight: 700, lineHeight: '1.2' },
      h2: { size: '24px', weight: 600, lineHeight: '1.25' },
      h3: { size: '20px', weight: 600, lineHeight: '1.3' },
      h4: { size: '18px', weight: 600, lineHeight: '1.35' },
      body: { size: '16px', weight: 400, lineHeight: '1.5' },
      small: { size: '14px', weight: 400, lineHeight: '1.5' },
      caption: { size: '12px', weight: 400, lineHeight: '1.4' },
      xs: { size: '11px', weight: 400, lineHeight: '1.4' },
    },
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },

  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 15px rgba(0,0,0,0.1)',
    xl: '0 20px 25px rgba(0,0,0,0.15)',
  },

  breakpoints: {
    mobile: '375px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1440px',
  },

  // Touch targets (minimum 44px for accessibility)
  touchTarget: {
    min: '44px',
    comfortable: '48px',
  },

  // Component variants
  badges: {
    new: { bg: '#DBEAFE', text: '#1E40AF' },
    accepted: { bg: '#FEF3C7', text: '#B45309' },
    resolved: { bg: '#D1FAE5', text: '#047857' },
    escalated: { bg: '#FEE2E2', text: '#B91C1C' },
  },
} as const;

export type Theme = typeof theme;
