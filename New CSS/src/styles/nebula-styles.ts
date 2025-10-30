/**
 * Nebula Command Design System - Style Objects
 * 
 * Reusable inline style objects for glass-morphism and glow effects
 * Use these with the style prop in React components
 * 
 * @example
 * // Basic glass card
 * import { glassCard } from './styles/nebula-styles';
 * <div style={glassCard}>Content</div>
 * 
 * @example
 * // Glass card with custom glow
 * import { glassCardWithColorGlow, resourceColors } from './styles/nebula-styles';
 * <div style={glassCardWithColorGlow(resourceColors.tyr.rgb, resourceColors.tyr.rgb)}>
 *   Tyr Card
 * </div>
 * 
 * @example
 * // Using resource colors with Tailwind classes
 * import { resourceColors } from './styles/nebula-styles';
 * <div className={`${resourceColors.tyr.bg} ${resourceColors.tyr.border} ${resourceColors.tyr.text}`}>
 *   Tyr: 5000
 * </div>
 */

export const glassCard: React.CSSProperties = {
  background: 'rgba(26, 15, 46, 0.6)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(232, 121, 249, 0.15)',
  boxShadow: '0 8px 32px 0 rgba(232, 121, 249, 0.1), inset 0 1px 0 0 rgba(232, 121, 249, 0.1)',
};

export const glassPanel: React.CSSProperties = {
  background: 'rgba(26, 15, 46, 0.7)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(232, 121, 249, 0.2)',
};

export const glassSubtle: React.CSSProperties = {
  background: 'rgba(26, 15, 46, 0.4)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(232, 121, 249, 0.1)',
};

export const glowPrimary: React.CSSProperties = {
  boxShadow: '0 0 20px rgba(232, 121, 249, 0.3), 0 0 40px rgba(232, 121, 249, 0.15)',
};

export const glowPrimarySubtle: React.CSSProperties = {
  boxShadow: '0 0 10px rgba(232, 121, 249, 0.2), 0 0 20px rgba(232, 121, 249, 0.1)',
};

export const glowTyr: React.CSSProperties = {
  boxShadow: '0 0 15px rgba(156, 163, 175, 0.3)',
};

export const glowMineral: React.CSSProperties = {
  boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
};

export const glowFood: React.CSSProperties = {
  boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)',
};

export const glowEnergy: React.CSSProperties = {
  boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)',
};

export const glowPopulation: React.CSSProperties = {
  boxShadow: '0 0 15px rgba(234, 88, 12, 0.3)',
};

// Resource Colors (for consistent theming across components)
export const resourceColors = {
  tyr: {
    text: 'text-gray-300',
    bg: 'bg-gray-400/10',
    border: 'border-gray-400/30',
    rgb: 'rgba(156, 163, 175, 0.3)',
    solid: '#9ca3af',
    progressColor: 'bg-gray-400',
  },
  mineral: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    rgb: 'rgba(239, 68, 68, 0.3)',
    solid: '#ef4444',
    progressColor: 'bg-red-500',
  },
  food: {
    text: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    rgb: 'rgba(34, 197, 94, 0.3)',
    solid: '#22c55e',
    progressColor: 'bg-green-500',
  },
  energy: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    rgb: 'rgba(6, 182, 212, 0.3)',
    solid: '#06b6d4',
    progressColor: 'bg-cyan-500',
  },
  population: {
    text: 'text-orange-500',
    bg: 'bg-orange-600/10',
    border: 'border-orange-600/30',
    rgb: 'rgba(234, 88, 12, 0.3)',
    solid: '#ea580c',
    progressColor: 'bg-orange-600',
  },
} as const;

// Type helper for resource names
export type ResourceType = keyof typeof resourceColors;

// Combined styles for common use cases
export const glassCardWithGlow = (glowStyle: React.CSSProperties = glowPrimary): React.CSSProperties => {
  const glassBoxShadow = glassCard.boxShadow || '';
  const glowBoxShadow = glowStyle.boxShadow || '';
  return {
    ...glassCard,
    boxShadow: glassBoxShadow && glowBoxShadow ? `${glassBoxShadow}, ${glowBoxShadow}` : glassBoxShadow || glowBoxShadow,
  };
};

export const glassCardHover: React.CSSProperties = {
  ...glassCard,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

// Helper function to merge glass card with custom border color
export const glassCardWithBorder = (borderColor: string, borderWidth: string = '2px'): React.CSSProperties => ({
  ...glassCard,
  border: `${borderWidth} solid ${borderColor}`,
});

// Helper function for glass card with specific glow color
export const glassCardWithColorGlow = (borderColor: string, glowColor: string): React.CSSProperties => {
  const glassBoxShadow = glassCard.boxShadow || '';
  const customGlow = `0 0 15px ${glowColor}`;
  return {
    ...glassCard,
    border: `2px solid ${borderColor}`,
    boxShadow: glassBoxShadow ? `${customGlow}, ${glassBoxShadow}` : customGlow,
  };
};

// Helper function to get resource glow style
export const getResourceGlow = (resource: ResourceType): React.CSSProperties => {
  const glowMap = {
    tyr: glowTyr,
    mineral: glowMineral,
    food: glowFood,
    energy: glowEnergy,
    population: glowPopulation,
  };
  return glowMap[resource];
};

// Common component styles
export const buttonNebula: React.CSSProperties = {
  background: 'rgba(26, 15, 46, 0.6)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(232, 121, 249, 0.4)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

export const inputNebula: React.CSSProperties = {
  background: 'rgba(45, 27, 78, 0.3)',
  border: '1px solid rgba(232, 121, 249, 0.2)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

export const progressNebula: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e879f9, #c084fc, #e879f9)',
  backgroundSize: '200% 100%',
};
