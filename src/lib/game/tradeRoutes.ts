/**
 * Trade route types and pure validation helpers.
 * Mutation functions (createTradeRoute, cancelTradeRoute, reapplyTradeRoutes)
 * live in gameState.ts alongside the analogous expansion functions.
 */

import type { ResourceId } from '../sim/engine/types';
import { TRAVEL_TIMES, type TravelScope, type FleetDriveLevel } from '../constants/travel';

// ============================================================================
// Types
// ============================================================================

export interface CargoCapacity {
  metal: number;
  mineral: number;
  shared_pool: number; // energy + food share this pool
}

export type TradeCargo = Record<'metal' | 'mineral' | 'food' | 'energy', number>;

export interface TradeRoute {
  id: string;
  shipId: string;
  sourcePlanetId: string;
  destinationPlanetId: string;
  departureTurn: number;
  arrivalTurn: number;
  travelScope: TravelScope;
  driveLevel: FleetDriveLevel;
  cargo: TradeCargo;
  cancelled: boolean;
}

export type TradeRouteStatus = 'scheduled' | 'in_transit' | 'delivered' | 'cancelled';

export interface CargoValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

export const TRADE_SHIP_IDS: readonly string[] = ['freighter', 'merchant', 'trader'];

export const TIMELINE_LENGTH = 200;

// ============================================================================
// Pure functions
// ============================================================================

export function computeArrivalTurn(
  departureTurn: number,
  driveLevel: FleetDriveLevel,
  travelScope: TravelScope,
): number {
  return departureTurn + TRAVEL_TIMES[driveLevel][travelScope];
}

export function getTradeRouteStatus(route: TradeRoute, viewTurn: number): TradeRouteStatus {
  if (route.cancelled) return 'cancelled';
  if (viewTurn < route.departureTurn) return 'scheduled';
  if (viewTurn < route.arrivalTurn) return 'in_transit';
  return 'delivered';
}

export function validateCargo(cargo: TradeCargo, capacity: CargoCapacity): CargoValidationResult {
  const errors: string[] = [];

  if (cargo.metal < 0 || cargo.mineral < 0 || cargo.food < 0 || cargo.energy < 0) {
    errors.push('Cargo values cannot be negative');
  }

  const total = cargo.metal + cargo.mineral + cargo.food + cargo.energy;
  if (total === 0) {
    errors.push('Cargo is empty');
    return { valid: false, errors };
  }

  if (cargo.metal > capacity.metal) {
    errors.push(`metal cargo (${cargo.metal}) exceeds ship limit (${capacity.metal})`);
  }
  if (cargo.mineral > capacity.mineral) {
    errors.push(`mineral cargo (${cargo.mineral}) exceeds ship limit (${capacity.mineral})`);
  }

  const sharedUsed = cargo.food + cargo.energy;
  if (sharedUsed > capacity.shared_pool) {
    errors.push(
      `shared pool usage (food ${cargo.food} + energy ${cargo.energy} = ${sharedUsed}) exceeds ship limit (${capacity.shared_pool})`,
    );
  }

  return { valid: errors.length === 0, errors };
}
