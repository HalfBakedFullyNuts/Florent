/**
 * PlanetDashboard Component Tests
 *
 * Ticket 22: Horizontal Planet Dashboard
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
  };

  const mockDefs = {
    metal_mine: { name: 'Metal Mine' },
    mineral_mine: { name: 'Mineral Mine' },
    farm: { name: 'Farm' },
    solar_panel: { name: 'Solar Panel' },
    shipyard: { name: 'Shipyard' },
  };

  describe('Layout and Structure (Ticket 22)', () => {
    it('should render horizontal layout with 4 sections', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Check for section headers
      expect(screen.getByText(/^Resources$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Population$/i)).toBeInTheDocument();
      expect(screen.getByText(/Space Remaining/i)).toBeInTheDocument();
      expect(screen.getByText(/^Buildings$/i)).toBeInTheDocument();

      // Check for grid layout classes (4 columns on desktop)
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should display resources with integer stocks and decimal outputs', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Stocks should be floored to integers
      expect(screen.getByText('30.123')).toBeInTheDocument(); // Metal stock
      expect(screen.getByText('20.456')).toBeInTheDocument(); // Mineral stock
      expect(screen.getByText('1.635')).toBeInTheDocument(); // Food stock

      // Outputs should have 1 decimal place with +/- sign (more flexible matching)
      expect(screen.getByText(/\+1\.200,5/i)).toBeInTheDocument(); // Metal output
      expect(screen.getByText(/-50,2/i)).toBeInTheDocument(); // Mineral output
    });

    it('should display population with workers, soldiers, scientists and housing', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Population section exists
      expect(screen.getByText(/^Population$/i)).toBeInTheDocument();

      // Workers, Soldiers, Scientists should appear with counts and caps
      const allText = container.textContent || '';
      expect(allText).toContain('Workers');
      expect(allText).toContain('Soldiers');
      expect(allText).toContain('Scientists');
      expect(allText).toContain('20.000'); // Workers count
      expect(allText).toContain('50k'); // Worker cap (abbreviated)
      expect(allText).toContain('100k'); // Soldier cap (abbreviated)
      expect(allText).toContain('25k'); // Scientist cap (abbreviated)
      expect(allText).toContain('10.000'); // Idle workers
      expect(allText).toContain('Workers will grow next turn'); // Growth hint
    });

    it('should display space remaining with ground and orbital', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Check for Space Remaining section
      expect(screen.getByText(/Space Remaining/i)).toBeInTheDocument();

      // Should show remaining space (cap - used)
      const allText = container.textContent || '';
      expect(allText).toContain('45'); // Ground remaining: 60 - 15 = 45
      expect(allText).toContain('35'); // Orbital remaining: 40 - 5 = 35

      // Ground and Orbital should have progress bars
      const progressBars = container.querySelectorAll('.rounded-full.h-2');
      expect(progressBars.length).toBeGreaterThanOrEqual(2); // At least 2 progress bars
    });

    it('should display buildings overview', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Check for Buildings section
      expect(screen.getByText(/^Buildings$/i)).toBeInTheDocument();

      // Buildings should be displayed with names and counts
      const allText = container.textContent || '';
      expect(allText).toContain('Metal Mine');
      expect(allText).toContain('×2'); // Metal Mine count
    });

    it('should display growth hint', () => {
      render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      expect(screen.getByText(/Workers will grow next turn/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design (Ticket 22)', () => {
    it('should have responsive grid classes', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Check for Tailwind responsive classes
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer?.className).toMatch(/grid-cols-/);
    });
  });

  describe('Visual Separation (Ticket 22)', () => {
    it('should have visual separation between sections', () => {
      const { container } = render(<PlanetDashboard summary={mockSummary} defs={mockDefs} />);

      // Check for gap or border classes
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer?.className).toMatch(/gap-/);
    });
  });
});
