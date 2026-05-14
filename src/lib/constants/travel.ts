export type TravelScope = 'inside_system' | 'inside_galaxy' | 'galaxy_to_galaxy';
export type FleetDriveLevel = 1 | 2 | 3;
export type GalaxyChoice = 'odd' | 'even';

export const TRAVEL_TIMES: Record<FleetDriveLevel, Record<TravelScope, number>> = {
  1: { inside_system: 11, inside_galaxy: 16, galaxy_to_galaxy: 26 },
  2: { inside_system: 9,  inside_galaxy: 14, galaxy_to_galaxy: 23 },
  3: { inside_system: 8,  inside_galaxy: 12, galaxy_to_galaxy: 21 },
};

// New-planet travel delays using Fleet Drive 1 (the only unlocked drive initially)
export const GALAXY_TRAVEL_DELAY: Record<GalaxyChoice, number> = {
  odd:  TRAVEL_TIMES[1].inside_galaxy,       // 16 turns
  even: TRAVEL_TIMES[1].galaxy_to_galaxy,    // 26 turns
};

export type ExpansionTravelChoice = 'inside_system' | 'inside_galaxy' | 'galaxy_to_galaxy';

export const DEFAULT_EXPANSION_TRAVEL_CHOICE: ExpansionTravelChoice = 'inside_galaxy';

export const EXPANSION_TRAVEL_CHOICES: Record<ExpansionTravelChoice, { label: string; scope: TravelScope }> = {
  inside_system:    { label: 'Same System',       scope: 'inside_system' },
  inside_galaxy:    { label: 'Same Galaxy',       scope: 'inside_galaxy' },
  galaxy_to_galaxy: { label: 'Different Galaxy',  scope: 'galaxy_to_galaxy' },
};

export function getExpansionTravelTime(
  choice: ExpansionTravelChoice,
  driveLevel: FleetDriveLevel = 1,
): number {
  return TRAVEL_TIMES[driveLevel][choice];
}
