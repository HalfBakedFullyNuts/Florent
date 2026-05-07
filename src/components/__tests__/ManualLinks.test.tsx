/**
 * Issue #17: Manual reference links — presence and safe-attribute checks
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanetDashboard } from '../PlanetDashboard';
import type { PlanetSummary as PlanetSummaryType } from '../../lib/game/selectors';
import { MANUAL_LINKS } from '../../lib/constants/manualLinks';

const baseSummary: PlanetSummaryType = {
  turn: 1,
  stocks: { metal: 0, mineral: 0, food: 100, energy: 0 },
  abundance: { metal: 1, mineral: 1, food: 1, energy: 1 },
  outputsPerTurn: { metal: 0, mineral: 0, food: 0, energy: 0 },
  space: { groundUsed: 0, groundCap: 60, orbitalUsed: 0, orbitalCap: 40 },
  housing: { workerCap: 1000, soldierCap: 1000, scientistCap: 1000 },
  population: { workersTotal: 100, workersIdle: 100, workersBusy: 0, soldiers: 0, scientists: 0 },
  ships: {},
  structures: {},
  foodUpkeep: 0,
  growthHint: '+1 workers at end of turn',
  planetLimit: 4,
  completedResearch: [],
  workerGrowthDetail: null,
};

const defs = {};

describe('PlanetDashboard manual links (Issue #17)', () => {
  it('has a resources manual link with correct href and safe attributes', () => {
    const { container } = render(<PlanetDashboard summary={baseSummary} defs={defs} />);
    const link = container.querySelector(`a[href="${MANUAL_LINKS.resources}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('has a structures manual link with correct href and safe attributes', () => {
    const { container } = render(<PlanetDashboard summary={baseSummary} defs={defs} />);
    const link = container.querySelector(`a[href="${MANUAL_LINKS.structures}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('has a ships manual link with correct href and safe attributes', () => {
    const { container } = render(<PlanetDashboard summary={baseSummary} defs={defs} />);
    const link = container.querySelector(`a[href="${MANUAL_LINKS.ships}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('has a travel times manual link with correct href and safe attributes', () => {
    const { container } = render(<PlanetDashboard summary={baseSummary} defs={defs} />);
    const link = container.querySelector(`a[href="${MANUAL_LINKS.travelTimes}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('has a colonists manual link with correct href and safe attributes', () => {
    const { container } = render(<PlanetDashboard summary={baseSummary} defs={defs} />);
    const link = container.querySelector(`a[href="${MANUAL_LINKS.colonists}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('all links have accessible aria-label attributes', () => {
    const { container } = render(<PlanetDashboard summary={baseSummary} defs={defs} />);
    const links = container.querySelectorAll('a[target="_blank"]');
    links.forEach((link) => {
      expect(link.getAttribute('aria-label')).toBeTruthy();
    });
  });
});
