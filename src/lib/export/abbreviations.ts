/**
 * Name abbreviation utilities for export formatting
 * Shortens long building names to save space in exports
 */

/**
 * Abbreviate item names for export display
 * Examples:
 * - "Core Mineral Extractor" → "Core Mineral"
 * - "Light Weapons Factory" → "Light Weapons"
 * - "Hydroponics Lab" → "Hydroponics"
 * - "Farm" → "Farm" (no change)
 */
export function abbreviateName(name: string): string {
  // List of suffixes to remove
  const suffixesToRemove = [
    'Extractor',
    'Factory',
    'Lab',
    'Mine',
  ];

  // Try to remove each suffix
  for (const suffix of suffixesToRemove) {
    if (name.endsWith(` ${suffix}`)) {
      return name.substring(0, name.length - suffix.length - 1).trim();
    }
  }

  // Special cases for specific abbreviations
  const specialAbbreviations: Record<string, string> = {
    'Hydroponics Dome': 'Hydro Dome',
  };

  if (specialAbbreviations[name]) {
    return specialAbbreviations[name];
  }

  // No abbreviation needed
  return name;
}
