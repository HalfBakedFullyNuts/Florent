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

/**
 * Abbreviate a name to fit within maxLen characters.
 * Used for research names in Discord export columns (15-char limit).
 *
 * Strategy: abbreviate each word to its first 3 chars + "." until the result fits.
 * Words of 4 chars or fewer are kept whole in the first pass.
 *
 * Examples (maxLen=15):
 *   "Resource Collection" → "Res. Col."
 *   "Planet Management"   → "Pla. Man."
 *   "Metal Processing"    → "Met. Pro."
 *   "Bio Lab"             → "Bio Lab"  (already ≤15)
 */
export function abbreviateToFit(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;

  const words = name.split(' ');

  // Pass 1: abbreviate words longer than 4 chars
  const pass1 = words
    .map(w => (w.length > 4 ? `${w.slice(0, 3)}.` : w))
    .join(' ');
  if (pass1.length <= maxLen) return pass1;

  // Pass 2: abbreviate ALL words
  const pass2 = words.map(w => `${w.slice(0, 3)}.`).join(' ');
  if (pass2.length <= maxLen) return pass2;

  // Fallback: hard slice
  return pass2.slice(0, maxLen);
}
