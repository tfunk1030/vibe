/**
 * Obsidian Arcade Theme System
 *
 * A fusion of luxury materials (obsidian, brass, velvet) with arcade nostalgia
 * (neon accents, pixel-perfect precision, satisfying feedback).
 */

// ==========================================
// Color Palette
// ==========================================

export const obsidianDark = {
  // Backgrounds (layered depth)
  bg: {
    void: '#050507',        // Deepest black
    obsidian: '#0a0a0f',    // Primary background
    slate: '#12121a',       // Card surfaces
    elevated: '#1a1a24',    // Elevated cards
    highlight: '#242430',   // Hover/active states
  },

  // Accents (neon arcade)
  accent: {
    primary: '#6366F1',     // Electric indigo (main actions)
    secondary: '#8B5CF6',   // Vivid purple (secondary)
    success: '#10B981',     // Emerald (solved/correct)
    warning: '#F59E0B',     // Amber (caution)
    danger: '#EF4444',      // Red (errors/delete)
    cyan: '#06B6D4',        // Cyan (info/hints)
    brass: '#D4A853',       // Brass/gold (luxury accent)
  },

  // Glow variants (for effects)
  glow: {
    indigo: 'rgba(99, 102, 241, 0.4)',
    purple: 'rgba(139, 92, 246, 0.4)',
    emerald: 'rgba(16, 185, 129, 0.4)',
    amber: 'rgba(245, 158, 11, 0.4)',
    cyan: 'rgba(6, 182, 212, 0.4)',
    brass: 'rgba(212, 168, 83, 0.3)',
  },

  // Text hierarchy
  text: {
    primary: '#F8FAFC',     // Pure white (headers)
    secondary: '#CBD5E1',   // Soft gray (body)
    muted: '#64748B',       // Muted (captions)
    subtle: '#475569',      // Very subtle (disabled)
  },

  // Borders & dividers
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    strong: 'rgba(255, 255, 255, 0.16)',
    brass: 'rgba(212, 168, 83, 0.4)',
  },
} as const;

export const obsidianLight = {
  bg: {
    void: '#F8FAFC',
    obsidian: '#F1F5F9',
    slate: '#FFFFFF',
    elevated: '#FFFFFF',
    highlight: '#E2E8F0',
  },
  accent: { ...obsidianDark.accent },
  glow: { ...obsidianDark.glow },
  text: {
    primary: '#0F172A',
    secondary: '#334155',
    muted: '#64748B',
    subtle: '#94A3B8',
  },
  border: {
    subtle: 'rgba(0, 0, 0, 0.04)',
    default: 'rgba(0, 0, 0, 0.08)',
    strong: 'rgba(0, 0, 0, 0.12)',
    brass: 'rgba(212, 168, 83, 0.5)',
  },
} as const;

// Region colors - Vibrant neon set for puzzle regions
export const regionColors = [
  '#FF6B6B',  // Coral Red
  '#4ECDC4',  // Teal
  '#FFE66D',  // Sunny Yellow
  '#95E1D3',  // Mint
  '#F38181',  // Salmon
  '#AA96DA',  // Lavender
  '#FCBAD3',  // Pink
  '#A8D8EA',  // Sky Blue
  '#FF9F43',  // Orange
  '#6C5CE7',  // Purple
  '#00CEC9',  // Cyan
  '#FD79A8',  // Hot Pink
] as const;

// ==========================================
// Theme Type
// ==========================================

export interface ThemeColors {
  bg: {
    void: string;
    obsidian: string;
    slate: string;
    elevated: string;
    highlight: string;
  };
  accent: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    cyan: string;
    brass: string;
  };
  glow: {
    indigo: string;
    purple: string;
    emerald: string;
    amber: string;
    cyan: string;
    brass: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    subtle: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    brass: string;
  };
}

export type ThemeMode = 'dark' | 'light';

export const getTheme = (mode: ThemeMode): ThemeColors => {
  return mode === 'dark' ? obsidianDark : obsidianLight;
};

// ==========================================
// Gradient Presets
// ==========================================

export const gradients = {
  // Background gradients
  obsidianBg: ['#050507', '#0a0a0f', '#12121a'] as const,
  obsidianBgReverse: ['#12121a', '#0a0a0f', '#050507'] as const,

  // Accent gradients
  indigoPurple: ['#6366F1', '#8B5CF6'] as const,
  purplePink: ['#8B5CF6', '#EC4899'] as const,
  cyanTeal: ['#06B6D4', '#14B8A6'] as const,
  amberOrange: ['#F59E0B', '#F97316'] as const,

  // Brass/gold luxury gradient
  brass: ['#D4A853', '#B8860B', '#D4A853'] as const,

  // Success gradient
  emerald: ['#10B981', '#059669'] as const,

  // Danger gradient
  danger: ['#EF4444', '#DC2626'] as const,
} as const;

// ==========================================
// Shadow Presets (iOS optimized)
// ==========================================

export const shadows = {
  // Subtle elevation
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  // Medium elevation
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  // Large elevation
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Neon glow effect
  glow: (color: string, intensity: number = 1) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6 * intensity,
    shadowRadius: 12 * intensity,
  }),

  // Brass glow
  brassGlow: {
    shadowColor: '#D4A853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
} as const;

// ==========================================
// Spacing Scale
// ==========================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// ==========================================
// Border Radius Scale
// ==========================================

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

// ==========================================
// Animation Timing
// ==========================================

export const timing = {
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
} as const;

// ==========================================
// Spring Configs (for reanimated)
// ==========================================

export const springs = {
  // Snappy, responsive
  snappy: {
    damping: 15,
    stiffness: 300,
  },
  // Bouncy, playful
  bouncy: {
    damping: 8,
    stiffness: 200,
  },
  // Smooth, elegant
  smooth: {
    damping: 20,
    stiffness: 150,
  },
  // Gentle, slow
  gentle: {
    damping: 25,
    stiffness: 100,
  },
} as const;
