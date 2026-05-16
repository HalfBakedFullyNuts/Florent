/**
 * Tests for trade route types, pure validators, and status derivation.
 */

import { describe, it, expect } from 'vitest';
import {
  computeArrivalTurn,
  getTradeRouteStatus,
  validateCargo,
  TRADE_SHIP_IDS,
  type TradeRoute,
  type CargoCapacity,
} from '../tradeRoutes';

const FREIGHTER_CAP: CargoCapacity = { metal: 120_000, mineral: 80_000, shared_pool: 40_000 };
const MERCHANT_CAP: CargoCapacity = { metal: 240_000, mineral: 160_000, shared_pool: 80_000 };

describe('computeArrivalTurn', () => {
  it('inside_system drive1 = departure + 11', () => {
    expect(computeArrivalTurn(10, 1, 'inside_system')).toBe(21);
  });

  it('inside_galaxy drive2 = departure + 14', () => {
    expect(computeArrivalTurn(5, 2, 'inside_galaxy')).toBe(19);
  });

  it('galaxy_to_galaxy drive3 = departure + 21', () => {
    expect(computeArrivalTurn(1, 3, 'galaxy_to_galaxy')).toBe(22);
  });
});

describe('getTradeRouteStatus', () => {
  const base: TradeRoute = {
    id: 'tr_1',
    shipId: 'freighter',
    sourcePlanetId: 'p1',
    destinationPlanetId: 'p2',
    departureTurn: 20,
    arrivalTurn: 31,
    travelScope: 'inside_system',
    driveLevel: 1,
    cargo: { metal: 50_000, mineral: 0, food: 0, energy: 0 },
    cancelled: false,
  };

  it('cancelled overrides everything', () => {
    expect(getTradeRouteStatus({ ...base, cancelled: true }, 5)).toBe('cancelled');
    expect(getTradeRouteStatus({ ...base, cancelled: true }, 25)).toBe('cancelled');
    expect(getTradeRouteStatus({ ...base, cancelled: true }, 99)).toBe('cancelled');
  });

  it('scheduled before departure', () => {
    expect(getTradeRouteStatus(base, 1)).toBe('scheduled');
    expect(getTradeRouteStatus(base, 19)).toBe('scheduled');
  });

  it('in_transit from departure until arrival', () => {
    expect(getTradeRouteStatus(base, 20)).toBe('in_transit');
    expect(getTradeRouteStatus(base, 25)).toBe('in_transit');
    expect(getTradeRouteStatus(base, 30)).toBe('in_transit');
  });

  it('delivered from arrival onward', () => {
    expect(getTradeRouteStatus(base, 31)).toBe('delivered');
    expect(getTradeRouteStatus(base, 99)).toBe('delivered');
  });
});

describe('validateCargo', () => {
  it('accepts valid metal-only cargo within capacity', () => {
    const result = validateCargo({ metal: 100_000, mineral: 0, food: 0, energy: 0 }, FREIGHTER_CAP);
    expect(result.valid).toBe(true);
  });

  it('rejects empty cargo', () => {
    const result = validateCargo({ metal: 0, mineral: 0, food: 0, energy: 0 }, FREIGHTER_CAP);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Cargo is empty');
  });

  it('rejects metal over per-resource limit', () => {
    const result = validateCargo({ metal: 130_000, mineral: 0, food: 0, energy: 0 }, FREIGHTER_CAP);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('metal'))).toBe(true);
  });

  it('rejects mineral over per-resource limit', () => {
    const result = validateCargo({ metal: 0, mineral: 90_000, food: 0, energy: 0 }, FREIGHTER_CAP);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('mineral'))).toBe(true);
  });

  it('rejects shared pool overflow (energy + food > shared_pool)', () => {
    const result = validateCargo({ metal: 0, mineral: 0, food: 30_000, energy: 20_000 }, FREIGHTER_CAP);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('shared pool'))).toBe(true);
  });

  it('accepts shared pool exactly at limit', () => {
    const result = validateCargo({ metal: 0, mineral: 0, food: 20_000, energy: 20_000 }, FREIGHTER_CAP);
    expect(result.valid).toBe(true);
  });

  it('accepts max capacity on merchant', () => {
    const result = validateCargo(
      { metal: 240_000, mineral: 160_000, food: 40_000, energy: 40_000 },
      MERCHANT_CAP,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects negative cargo values', () => {
    const result = validateCargo({ metal: -1000, mineral: 0, food: 0, energy: 0 }, FREIGHTER_CAP);
    expect(result.valid).toBe(false);
  });
});

describe('TRADE_SHIP_IDS', () => {
  it('contains the three trade ships', () => {
    expect(TRADE_SHIP_IDS).toContain('freighter');
    expect(TRADE_SHIP_IDS).toContain('merchant');
    expect(TRADE_SHIP_IDS).toContain('trader');
  });
});
