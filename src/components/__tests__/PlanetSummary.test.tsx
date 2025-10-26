/**
 * PlanetSummary Component Tests
 *
 * Ticket 20: Resource Display Formatting
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanetSummary } from '../PlanetSummary';
import type { PlanetSummary as PlanetSummaryType } from '../../lib/game/selectors';

describe('PlanetSummary', () => {
  describe('Resource Display Formatting (Ticket 20)', () => {
    it('should display resources as integers without decimals', () => {
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
          mineral: 1.0,
          food: 1.0,
          energy: 1.0,
        },
        outputsPerTurn: {
          metal: 1200,
          mineral: 800,
          food: 100,
          energy: 30,
        },
        space: {
          groundUsed: 5,
          groundCap: 20,
          orbitalUsed: 0,
          orbitalCap: 10,
        },
        housing: {
          workerCap: 50000,
          soldierCap: 0,
          scientistCap: 0,
        },
        population: {
          workersTotal: 20000,
          workersIdle: 10000,
          workersBusy: 10000,
          soldiers: 0,
          scientists: 0,
        },
        ships: {},
        foodUpkeep: 20,
        growthHint: 'Workers will grow next turn',
      };

      render(<PlanetSummary summary={mockSummary} />);

      // Metal should show 30.123 not 30.123,456
      expect(screen.getByText(/30\.123/)).toBeInTheDocument();

      // Mineral should show 20.456 not 20.456,789
      expect(screen.getByText(/20\.456/)).toBeInTheDocument();

      // Food should show 1.635 not 1.635,96 (THIS IS THE BUG)
      expect(screen.getByText(/1\.635/)).toBeInTheDocument();
      expect(screen.queryByText(/1\.635,96/)).not.toBeInTheDocument();

      // Energy should show 520 not 520,123
      expect(screen.getByText(/^520$/)).toBeInTheDocument();
    });

    it('should display production outputs with one decimal place', () => {
      const mockSummary: PlanetSummaryType = {
        turn: 5,
        stocks: {
          metal: 30000,
          mineral: 20000,
          food: 1000,
          energy: 500,
        },
        abundance: {
          metal: 1.0,
          mineral: 1.0,
          food: 1.0,
          energy: 1.0,
        },
        outputsPerTurn: {
          metal: 1250.678, // Should display as +1.250,7 or +1250.7
          mineral: -50.234, // Should display as -50,2 or -50.2
          food: 100.0,
          energy: 30.5,
        },
        space: {
          groundUsed: 5,
          groundCap: 20,
          orbitalUsed: 0,
          orbitalCap: 10,
        },
        housing: {
          workerCap: 50000,
          soldierCap: 0,
          scientistCap: 0,
        },
        population: {
          workersTotal: 20000,
          workersIdle: 10000,
          workersBusy: 10000,
          soldiers: 0,
          scientists: 0,
        },
        ships: {},
        foodUpkeep: 20,
        growthHint: 'Workers will grow next turn',
      };

      render(<PlanetSummary summary={mockSummary} />);

      // Metal output should show with at most 1 decimal
      // European format would be +1.250,7 but let's check for the number
      const metalOutput = screen.getByText(/\+1\.250,7|\+1\.251/);
      expect(metalOutput).toBeInTheDocument();
    });

    it('should handle zero and negative values correctly', () => {
      const mockSummary: PlanetSummaryType = {
        turn: 5,
        stocks: {
          metal: 0,
          mineral: 0.5, // Should round down to 0
          food: -10.9, // Should floor to -10 (or be clamped at 0)
          energy: 0,
        },
        abundance: {
          metal: 1.0,
          mineral: 1.0,
          food: 1.0,
          energy: 1.0,
        },
        outputsPerTurn: {
          metal: 0,
          mineral: -5,
          food: 0,
          energy: -10,
        },
        space: {
          groundUsed: 5,
          groundCap: 20,
          orbitalUsed: 0,
          orbitalCap: 10,
        },
        housing: {
          workerCap: 50000,
          soldierCap: 0,
          scientistCap: 0,
        },
        population: {
          workersTotal: 20000,
          workersIdle: 10000,
          workersBusy: 10000,
          soldiers: 0,
          scientists: 0,
        },
        ships: {},
        foodUpkeep: 20,
        growthHint: 'Warning: Negative food!',
      };

      render(<PlanetSummary summary={mockSummary} />);

      // Should display zeros without decimals
      const zeros = screen.getAllByText(/^0$/);
      expect(zeros.length).toBeGreaterThan(0);

      // Negative output should show minus sign
      expect(screen.getByText(/-5/)).toBeInTheDocument();
      expect(screen.getByText(/-10/)).toBeInTheDocument();
    });
  });
});
