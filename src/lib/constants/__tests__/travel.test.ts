import { describe, it, expect } from 'vitest';
import { TRAVEL_TIMES, GALAXY_TRAVEL_DELAY } from '../travel';

describe('travel constants', () => {
  it('Fleet Drive 1 travel times are correct', () => {
    expect(TRAVEL_TIMES[1].inside_system).toBe(11);
    expect(TRAVEL_TIMES[1].inside_galaxy).toBe(16);
    expect(TRAVEL_TIMES[1].galaxy_to_galaxy).toBe(26);
  });

  it('Fleet Drive 2 travel times are correct', () => {
    expect(TRAVEL_TIMES[2].inside_system).toBe(9);
    expect(TRAVEL_TIMES[2].inside_galaxy).toBe(14);
    expect(TRAVEL_TIMES[2].galaxy_to_galaxy).toBe(23);
  });

  it('Fleet Drive 3 travel times are correct', () => {
    expect(TRAVEL_TIMES[3].inside_system).toBe(8);
    expect(TRAVEL_TIMES[3].inside_galaxy).toBe(12);
    expect(TRAVEL_TIMES[3].galaxy_to_galaxy).toBe(21);
  });

  it('Odd Galaxy travel delay uses Fleet Drive 1 inside_galaxy (16)', () => {
    expect(GALAXY_TRAVEL_DELAY.odd).toBe(16);
  });

  it('Even Galaxy travel delay uses Fleet Drive 1 galaxy_to_galaxy (26)', () => {
    expect(GALAXY_TRAVEL_DELAY.even).toBe(26);
  });
});
