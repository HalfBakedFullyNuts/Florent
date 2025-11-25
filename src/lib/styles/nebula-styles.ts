/**
 * Nebula Command Design System - TypeScript Style Module
 *
 * Provides inline style objects and resource color mappings for the Nebula design system.
 * Use these when CSS classes aren't sufficient or when programmatic styling is needed.
 */

import { CSSProperties } from 'react';

// ============================================
// Glass-morphism Inline Styles
// ============================================

export const glassCard: CSSProperties = {
  background: 'rgba(26, 15, 46, 0.6)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '0.5rem',
};

export const glassPanel: CSSProperties = {
  background: 'rgba(26, 15, 46, 0.4)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '0.375rem',
};

export const glassSubtle: CSSProperties = {
  background: 'rgba(26, 15, 46, 0.3)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255, 255, 255, 0.03)',
  borderRadius: '0.25rem',
};

// ============================================
// Glow Effect Inline Styles
// ============================================

export const glowPrimary: CSSProperties = {
  boxShadow: '0 0 20px rgba(232, 121, 249, 0.3)',
};

export const glowPrimarySubtle: CSSProperties = {
  boxShadow: '0 0 10px rgba(232, 121, 249, 0.15)',
};

export const glowSecondary: CSSProperties = {
  boxShadow: '0 0 20px rgba(192, 132, 252, 0.3)',
};

export const glowAccent: CSSProperties = {
  boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)',
};

// ============================================
// Resource Color Mappings
// ============================================

export type ResourceType = 'metal' | 'mineral' | 'food' | 'energy';

export interface ResourceColorScheme {
  text: string;
  glow: string;
  border: string;
  bg: string;
  color: string;
}

export const resourceColors: Record<ResourceType, ResourceColorScheme> = {
  metal: {
    text: 'text-gray-300',
    glow: 'glow-tyr',
    border: 'border-gray-400/30',
    bg: 'bg-gray-400/10',
    color: '#9ca3af',
  },
  mineral: {
    text: 'text-red-400',
    glow: 'glow-mineral',
    border: 'border-red-400/30',
    bg: 'bg-red-400/10',
    color: '#f87171',
  },
  food: {
    text: 'text-green-400',
    glow: 'glow-food',
    border: 'border-green-400/30',
    bg: 'bg-green-400/10',
    color: '#86efac',
  },
  energy: {
    text: 'text-blue-400',
    glow: 'glow-energy',
    border: 'border-blue-400/30',
    bg: 'bg-blue-400/10',
    color: '#60a5fa',
  },
};

// ============================================
// Nebula Color Palette
// ============================================

export const nebulaColors = {
  primary: '#e879f9',
  secondary: '#c084fc',
  accent: '#7c3aed',
  bgDark: 'rgba(26, 15, 46, 0.95)',
  bgMedium: 'rgba(26, 15, 46, 0.6)',
  bgLight: 'rgba(26, 15, 46, 0.3)',
} as const;

// ============================================
// Lane Color Mappings
// ============================================

export type LaneType = 'building' | 'ship' | 'colonist';

export interface LaneColorScheme {
  glow: string;
  border: string;
  bg: string;
  color: string;
}

export const laneColors: Record<LaneType, LaneColorScheme> = {
  building: {
    glow: 'glow-primary',
    border: 'border-primary/40',
    bg: 'bg-primary/10',
    color: nebulaColors.primary,
  },
  ship: {
    glow: 'glow-accent',
    border: 'border-purple-600/40',
    bg: 'bg-purple-600/10',
    color: nebulaColors.accent,
  },
  colonist: {
    glow: 'glow-secondary',
    border: 'border-purple-400/40',
    bg: 'bg-purple-400/10',
    color: nebulaColors.secondary,
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get resource color scheme by resource type
 */
export function getResourceColors(resource: ResourceType): ResourceColorScheme {
  return resourceColors[resource];
}

/**
 * Get lane color scheme by lane type
 */
export function getLaneColors(lane: LaneType): LaneColorScheme {
  return laneColors[lane];
}

/**
 * Combine glass and glow styles
 */
export function combineGlassGlow(
  glassStyle: CSSProperties,
  glowStyle: CSSProperties
): CSSProperties {
  return {
    ...glassStyle,
    ...glowStyle,
  };
}
