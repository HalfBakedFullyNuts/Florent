/**
 * PlanetDashboard Component Tests
 *
 * Ticket 22: Horizontal Planet Dashboard
 * Issue #14: Worker tooltip, space in buildings header, ships panel
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanetDashboard } from '../PlanetDashboard';
import type { PlanetSummary as PlanetSummaryType } from '../../lib/game/selectors';

describe('PlanetDashboard', () => {
  const mockSummary: PlanetSummaryType = {
    turn: 5,
    stocks: {
      metal: 30123.456,
      mineral: 20456.789,
      food: 1635.96,
      energy: 520.123,
    },
    abundance: {
      metal: 1.0,
      mineral: 0.8,
      food: 1.2,
      energy: 1.0,
    },
    outputsPerTurn: {
      metal: 1200.5,
      mineral: -50.2,
      food: 100.0,
      energy: 30.7,
    },
    space: {
      groundUsed: 15,
      groundCap: 60,
      orbitalUsed: 5,
      orbitalCap: 40,
    },
    housing: {
      workerCap: 50000,
      soldierCap: 100000,
      scientistCap: 25000,
    },
    population: {
      workersTotal: 20000,
      workersIdle: 10000,
      workersBusy: 10000,
      soldiers: 5000,
      scientists: 1000,
    },
    ships: {
      fighter: 10,
      corvette: 5,
      destroyer: 2,
    },
    structures: {
      metal_mine: 4,
      mineral_mine: 2,
      farm: 3,
      solar_panel: 5,
      shipyard: 1,
    },
    foodUpkeep: 20,
    growthHint: 'Workers will grow next turn',
    planetLimit: 4,
    completedResearch: [],
    workerGrowthDetail: null,
  };

  const mockDefs = {
    metal_mine: { name: 'Metal Mine' },
    mineral_mine: { name: 'Mineral Mine' },
    farm: { name: 'Farm' },
    solar_panel: { name: 'Solar Panel' },
    shipyard: { name: 'Shipyard' },
    fighter: { name: 'Fighter' },
    destroyer: { name: 'Destroyer' },
  };

  describe('Layout and Structure', () => {
    it('should render horizontal layout with 4 sections', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      expect(screen.getByText(/^Resources$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Population$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Ships$/i)).toBeInTheDocument();

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should display resources with integer stocks and decimal outputs', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      expect(screen.getByText('30.123')).toBeInTheDocument();
      expect(screen.getByText('20.456')).toBeInTheDocument();
      expect(screen.getByText('1.635')).toBeInTheDocument();

      expect(screen.getByText(/\+1\.200,5/i)).toBeInTheDocument();
      expect(screen.getByText(/-50,2/i)).toBeInTheDocument();
    });

    it('should display population with workers, soldiers, scientists and housing', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      expect(screen.getByText(/^Population$/i)).toBeInTheDocument();

      const allText = container.textContent || '';
      expect(allText).toContain('Workers');
      expect(allText).toContain('Soldiers');
      expect(allText).toContain('Scientists');
      expect(allText).toContain('20.000');
      expect(allText).toContain('50k');
      expect(allText).toContain('100k');
      expect(allText).toContain('25k');
      expect(allText).toContain('10.000');
      expect(allText).toContain('Workers will grow next turn');
    });

    it('should NOT have a Space Remaining heading', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      expect(screen.queryByText(/Space Remaining/i)).not.toBeInTheDocument();
    });

    it('should display buildings section with space numbers in header', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      const allText = container.textContent || '';
      // groundFree = 60 - 15 = 45, orbitalFree = 40 - 5 = 35
      expect(allText).toContain('45 GS');
      expect(allText).toContain('35 OS');
      expect(allText).toContain('free');
      expect(allText).toContain('Metal Mine');
      expect(allText).toContain('×2');
    });

    it('should display abundance-scaled building production', () => {
      const summary: PlanetSummaryType = {
        ...mockSummary,
        abundance: {
          ...mockSummary.abundance,
          metal: 1.5,
          food: 0.5,
        },
        structures: {
          metal_mine: 2,
          farm: 3,
        },
      };
      const defs = {
        metal_mine: {
          name: 'Metal Mine',
          effectsOnComplete: { production_metal: 300 },
          upkeepPerUnit: {},
          costsPerUnit: {},
          isAbundanceScaled: true,
        },
        farm: {
          name: 'Farm',
          effectsOnComplete: { production_food: 100 },
          upkeepPerUnit: {},
          costsPerUnit: {},
          isAbundanceScaled: true,
        },
      };

      const { container } = render(<PlanetDashboard summary={summary} defs={defs} />);
      const allText = container.textContent || '';

      expect(allText).toContain('+900');
      expect(allText).toContain('+150');
    });

    it('should display growth hint', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      expect(screen.getByText(/Workers will grow next turn/i)).toBeInTheDocument();
    });
  });

  describe('Ships Panel', () => {
    it('should render a Ships section', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      expect(screen.getByText(/^Ships$/i)).toBeInTheDocument();
    });

    it('should display ships present on the planet', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const allText = container.textContent || '';
      expect(allText).toContain('Fighter');
      expect(allText).toContain('Destroyer');
    });

    it('should sort ships: fighter before destroyer', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const allText = container.textContent || '';
      const fighterPos = allText.indexOf('Fighter');
      const destroyerPos = allText.indexOf('Destroyer');
      expect(fighterPos).toBeGreaterThan(-1);
      expect(destroyerPos).toBeGreaterThan(-1);
      expect(fighterPos).toBeLessThan(destroyerPos);
    });

    it('should show zero-state text when no ships are present', () => {
      const emptyShipsSummary = { ...mockSummary, ships: {} };
      render(<PlanetDashboard summary={emptyShipsSummary} defs={mockDefs} />);
      expect(screen.getByText(/No ships/i)).toBeInTheDocument();
    });

    it('should show planet limit in the Ships panel', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const allText = container.textContent || '';
      expect(allText).toContain('Planet Limit');
    });
  });

  describe('Worker Tooltip', () => {
    it('should render a worker button with tooltip role', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const workerBtn = screen.getByRole('button', { name: /Worker growth details/i });
      expect(workerBtn).toBeInTheDocument();
    });

    it('should show no-growth message in tooltip when workerGrowthDetail is null', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const tooltip = container.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toContain('No growth');
    });

    it('should show growth rate when workerGrowthDetail is present', () => {
      const growingSummary: PlanetSummaryType = {
        ...mockSummary,
        workerGrowthDetail: { growthPerTurn: 200, ratePercent: 1, turnsToDouble: 70 },
      };
      const { container } = render(<PlanetDashboard summary={growingSummary} defs={mockDefs} />);
      const tooltip = container.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toContain('Growth rate: 1%/turn');
      expect(tooltip?.textContent).toContain('Doubles in ~70 turns');
    });

    it('should show housing cap timing in tooltip when turnsToHousingCap is set', () => {
      const growingSummary: PlanetSummaryType = {
        ...mockSummary,
        workerGrowthDetail: { growthPerTurn: 200, ratePercent: 1, turnsToDouble: 70 },
      };
      const { container } = render(
        <PlanetDashboard summary={growingSummary} defs={mockDefs} turnsToHousingCap={4} />,
      );
      const tooltip = container.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toContain('Housing cap in 4 turns');
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive grid classes', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer?.className).toMatch(/grid-cols-/);
    });

    it('should have visual separation between sections', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer?.className).toMatch(/gap-/);
    });
  });
});
