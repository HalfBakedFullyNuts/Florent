/**
 * Test to validate complete build order export (completed + active + pending)
 * This is the critical use case: sharing your full strategy with friends
 */

import { describe, it, expect } from 'vitest';
import { GameController } from '../../game/commands';
import { getLaneView } from '../../game/selectors';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter.client';
import gameDataRaw from '../../game/game_data.json';
import { formatAsText, formatAsDiscord } from '../formatters';

describe('Complete Build Order Export', () => {
  it('should export complete build order with all item statuses', () => {
    // Setup: Create a scenario with completed, active, and pending items
    const defs = loadGameData(gameDataRaw as any);
    const initialState = createStandardStart(defs);
    const controller = new GameController(initialState);

    // Queue some buildings at turn 1
    controller.queueItem(1, 'farm', 1);           // Will complete at T4
    controller.queueItem(1, 'metal_mine', 1);     // Will complete at T8
    controller.queueItem(1, 'mineral_extractor', 1); // Will complete at T12

    // Move to turn 10 where:
    // - Farm is completed (T4)
    // - Metal Mine is completed (T8)
    // - Mineral Extractor is active (completing at T12)
    const state = controller.getStateAtTurn(10);

    const buildingLane = getLaneView(state, 'building');
    const shipLane = getLaneView(state, 'ship');
    const colonistLane = getLaneView(state, 'colonist');

    console.log('\n=== Build Order at Turn 10 ===');
    console.log('Building Lane entries:', buildingLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      completionTurn: e.completionTurn,
      eta: e.eta
    })));

    // Export the complete build order
    const lanes = [buildingLane, shipLane, colonistLane];
    const plainText = formatAsText(lanes);

    console.log('\n=== Plain Text Export (Complete Build Order) ===');
    console.log(plainText);

    // Verify all items are included in the export (with abbreviations)
    expect(plainText).toContain('Farm');           // Completed at T4
    expect(plainText).toContain('Metal');          // "Metal Mine" → "Metal" (Completed at T8)
    expect(plainText).toContain('Mineral');        // "Mineral Extractor" → "Mineral" (Active at T10, completing T13)

    // Verify proper formatting with turn numbers
    expect(plainText).toContain('[4]');  // Farm completion
    expect(plainText).toContain('[8]');  // Metal Mine completion
    expect(plainText).toContain('[13]'); // Mineral Extractor completion (T10 + 3 remaining)

    // Test Discord export too
    const discord = formatAsDiscord(lanes);
    console.log('\n=== Discord Export (Complete Build Order) ===');
    console.log(discord);

    expect(discord).toContain('Farm');
    expect(discord).toContain('Metal'); // Abbreviated from "Metal Mine"
    expect(discord).toContain('Mineral'); // Abbreviated from "Mineral Extractor"

    // The export should have all 3 items
    const lines = plainText.split('\n');
    expect(lines.length).toBe(3);
  });

  it('should export build order with current view filter', () => {
    // Test "Export Current View" mode (maxTurn filter)
    const defs = loadGameData(gameDataRaw as any);
    const initialState = createStandardStart(defs);
    const controller = new GameController(initialState);

    controller.queueItem(1, 'farm', 1);           // Completes at T4
    controller.queueItem(1, 'metal_mine', 1);     // Completes at T8
    controller.queueItem(1, 'mineral_extractor', 1); // Completes at T12

    // At turn 6, farm is completed, metal mine is active, mineral extractor is pending
    const state = controller.getStateAtTurn(6);
    const buildingLane = getLaneView(state, 'building');

    // Export with maxTurn = 6 (current view mode)
    const plainText = formatAsText([buildingLane], 6);

    console.log('\n=== Current View Export (up to Turn 6) ===');
    console.log(plainText);

    // Should include farm (completed at T4)
    expect(plainText).toContain('Farm');
    expect(plainText).toContain('[4]');

    // Should NOT include items completing after turn 6
    expect(plainText).not.toContain('[8]');  // Metal Mine
    expect(plainText).not.toContain('[12]'); // Mineral Extractor
  });
});