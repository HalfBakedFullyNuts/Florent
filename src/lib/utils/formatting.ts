/**
 * Shared formatting utilities for numbers and outputs
 * Extracted from PlanetDashboard and PlanetSummary to avoid duplication
 */

/**
 * Format number with locale separators (German format)
 */
export const formatNumber = (num: number): string => {
  return Math.floor(num).toLocaleString('de-DE');
};

/**
 * Format large numbers with K suffix
 */
export const formatWithK = (num: number): string => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return Math.floor(num).toString();
};

/**
 * Format output with +/- prefix and color coding
 */
export const formatOutput = (output: number): { text: string; colorClass: string } => {
  const formatted = output >= 0 ? `+${formatNumber(output)}` : formatNumber(output);
  const colorClass = output > 0 ? 'text-green-400' : output < 0 ? 'text-red-400' : 'text-gray-400';

  return { text: formatted, colorClass };
};

/**
 * Format percentage value
 */
export const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`;
};
