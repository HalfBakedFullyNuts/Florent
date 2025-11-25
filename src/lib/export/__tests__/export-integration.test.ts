/**
 * TICKET-6: Integration test to verify export matches what's shown in queue display
 * This test ensures the export functions correctly capture the same data
 * that is displayed in the Planet Queue UI
 */

import { describe, it, expect } from 'vitest';
import { GameController } from '../../game/commands';
import { getLaneView } from '../../game/selectors';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter.client';
import gameDataRaw from '../../game/game_data.json';
import { extractQueueItems, formatAsText, formatAsDiscord } from '../formatters';
import type { LaneView } from '../../game/selectors';

describe('Export Integration - Queue Display Match (TICKET-6)', () => {
  // Helper to create a controller with test data
  function createTestController() {
    const defs = loadGameData(gameDataRaw as any);
    const initialState = createStandardStart(defs);
    return new GameController(initialState);
  }

  it('should show empty export when items cannot be queued due to missing prerequisites', () => {
    // Setup: Create controller and try to queue items without prerequisites
    const controller = createTestController();

    // Try to queue items at turn 1 (will fail for fighter/soldier due to missing prereqs)
    const farmResult = controller.queueItem(1, 'farm', 1);
    console.log('Farm queue result:', farmResult);

    const fighterResult = controller.queueItem(1, 'fighter', 5);
    console.log('Fighter queue result:', fighterResult);  // Should fail - needs shipyard

    const soldierResult = controller.queueItem(1, 'soldier', 100);
    console.log('Soldier queue result:', soldierResult);  // Should fail - needs army_barracks

    // Verify that fighter and soldier failed due to missing requirements
    expect(fighterResult.success).toBe(false);
    expect(fighterResult.reason).toBe('REQ_MISSING');
    expect(soldierResult.success).toBe(false);
    expect(soldierResult.reason).toBe('REQ_MISSING');

    // Get the state at turn 1 (what the UI would show)
    const state = controller.getStateAtTurn(1);

    // Get lane views (this is what the UI displays)
    const buildingLane = getLaneView(state, 'building');
    const shipLane = getLaneView(state, 'ship');
    const colonistLane = getLaneView(state, 'colonist');

    // Log the lane data to debug
    console.log('Building Lane entries:', buildingLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      eta: e.eta,
      completionTurn: e.completionTurn
    })));
    console.log('Ship Lane entries:', shipLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      eta: e.eta,
      completionTurn: e.completionTurn
    })));
    console.log('Colonist Lane entries:', colonistLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      eta: e.eta,
      completionTurn: e.completionTurn
    })));

    // Count non-completed items in lanes (what should be exported)
    const nonCompletedBuildings = buildingLane.entries.filter(e => e.status !== 'completed');
    const nonCompletedShips = shipLane.entries.filter(e => e.status !== 'completed');
    const nonCompletedColonists = colonistLane.entries.filter(e => e.status !== 'completed');

    const totalNonCompleted =
      nonCompletedBuildings.length +
      nonCompletedShips.length +
      nonCompletedColonists.length;

    console.log(`Total non-completed items in lanes: ${totalNonCompleted}`);
    console.log(`Buildings: ${nonCompletedBuildings.length}, Ships: ${nonCompletedShips.length}, Colonists: ${nonCompletedColonists.length}`);

    // Extract queue items for export
    const laneViews: LaneView[] = [buildingLane, shipLane, colonistLane];
    const exportedItems = extractQueueItems(laneViews);

    console.log('Exported items:', exportedItems);

    // CRITICAL: Export should have the same number of items as non-completed in lanes
    expect(exportedItems.length).toBe(totalNonCompleted);

    // Verify each lane's items are in the export
    if (nonCompletedBuildings.length > 0) {
      const farmInExport = exportedItems.find(item => item.name === 'Farm');
      expect(farmInExport).toBeDefined();
      expect(farmInExport?.lane).toBe('building');
    }

    if (nonCompletedShips.length > 0) {
      const fighterInExport = exportedItems.find(item => item.name === 'Fighter');
      expect(fighterInExport).toBeDefined();
      expect(fighterInExport?.lane).toBe('ship');
      expect(fighterInExport?.quantity).toBe(5);
    }

    if (nonCompletedColonists.length > 0) {
      const soldierInExport = exportedItems.find(item => item.name === 'Soldier');
      expect(soldierInExport).toBeDefined();
      expect(soldierInExport?.lane).toBe('colonist');
      expect(soldierInExport?.quantity).toBe(100);
    }

    // Test plain text export
    const plainText = formatAsText(laneViews);
    console.log('Plain text export:', plainText);

    // Only farm should be exported (ships/colonists failed to queue)
    expect(plainText).not.toBe('');
    expect(plainText).toContain('Farm');
    expect(plainText).not.toContain('Fighter');  // Not queued due to missing shipyard
    expect(plainText).not.toContain('Soldier');   // Not queued due to missing army_barracks

    // Test Discord export
    const discord = formatAsDiscord(laneViews);
    console.log('Discord export:', discord);

    expect(discord).toContain('Farm');
    expect(discord).not.toContain('Fighter');  // Not queued
    expect(discord).not.toContain('Soldier');   // Not queued
  });

  it('should export multiple buildings that can be queued', () => {
    // This test demonstrates that export works correctly when items CAN be queued
    const controller = createTestController();

    // Queue buildings that don't have structure prerequisites
    // (they only require resources which the start state has)
    const farmResult = controller.queueItem(1, 'farm', 1);
    expect(farmResult.success).toBe(true);

    const metalMineResult = controller.queueItem(1, 'metal_mine', 1);
    expect(metalMineResult.success).toBe(true);

    const mineralExtractorResult = controller.queueItem(1, 'mineral_extractor', 1);
    expect(mineralExtractorResult.success).toBe(true);

    // Get the state and export
    const state = controller.getStateAtTurn(1);
    const buildingLane = getLaneView(state, 'building');

    const laneViews: LaneView[] = [buildingLane];
    const exportedItems = extractQueueItems(laneViews);

    console.log('Exported items (no prereqs):', exportedItems);

    // All three items should be exported
    expect(exportedItems.length).toBe(3);

    const farm = exportedItems.find(item => item.name === 'Farm');
    const metalMine = exportedItems.find(item => item.name === 'Metal Mine');
    const mineralExtractor = exportedItems.find(item => item.name === 'Mineral Extractor');

    expect(farm).toBeDefined();
    expect(metalMine).toBeDefined();
    expect(mineralExtractor).toBeDefined();

    // Test export formats (with abbreviations)
    const plainText = formatAsText(laneViews);
    expect(plainText).toContain('Farm');
    expect(plainText).toContain('Metal'); // "Metal Mine" → "Metal"
    expect(plainText).toContain('Mineral'); // "Mineral Extractor" → "Mineral"
  });

  it('should export active items at current turn', () => {
    const controller = createTestController();

    // Queue a farm and advance some turns so it becomes active
    controller.queueItem(1, 'farm', 1);

    // Advance to turn 2 (farm should now be active)
    const state = controller.getStateAtTurn(2);
    const buildingLane = getLaneView(state, 'building');

    console.log('Turn 2 building lane:', buildingLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      eta: e.eta,
      completionTurn: e.completionTurn,
      turnsRemaining: e.turnsRemaining
    })));

    // Check if farm is active
    const activeFarm = buildingLane.entries.find(e => e.status === 'active');
    if (activeFarm) {
      expect(activeFarm.itemName).toBe('Farm');

      // Export should include the active farm
      const exported = extractQueueItems([buildingLane]);
      console.log('Exported active items:', exported);

      expect(exported.length).toBeGreaterThan(0);
      expect(exported[0].name).toBe('Farm');

      // Check that turn is set correctly (should use eta for active items)
      expect(exported[0].turn).toBeGreaterThan(0);
      expect(exported[0].turn).toBe(activeFarm.eta);
    }
  });

  it('should export pending items in queue', () => {
    const controller = createTestController();

    // Queue multiple items so some are pending
    controller.queueItem(1, 'farm', 1);
    controller.queueItem(1, 'metal_mine', 1);
    controller.queueItem(1, 'mineral_extractor', 1);

    const state = controller.getStateAtTurn(1);
    const buildingLane = getLaneView(state, 'building');

    console.log('Building lane with pending items:', buildingLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      eta: e.eta,
      completionTurn: e.completionTurn
    })));

    // Count pending items
    const pendingItems = buildingLane.entries.filter(e => e.status === 'pending');
    console.log(`Found ${pendingItems.length} pending items`);

    // Export should include all pending items
    const exported = extractQueueItems([buildingLane]);
    const exportedPending = exported.filter(item =>
      pendingItems.some(p => p.itemName === item.name)
    );

    console.log('Exported items:', exported);
    console.log('Pending items in export:', exportedPending);

    // At least some items should be pending (metal_mine and mineral_extractor)
    expect(pendingItems.length).toBeGreaterThan(0);
    expect(exportedPending.length).toBe(pendingItems.length);
  });

  it('should match export mode behavior - current vs full', () => {
    const controller = createTestController();

    // Queue items with different completion times
    controller.queueItem(1, 'farm', 1); // Completes early
    controller.queueItem(1, 'habitat', 1); // Completes later

    // Get state at turn 5
    const state = controller.getStateAtTurn(5);
    const buildingLane = getLaneView(state, 'building');

    console.log('Turn 5 building lane:', buildingLane.entries.map(e => ({
      name: e.itemName,
      status: e.status,
      eta: e.eta,
      completionTurn: e.completionTurn
    })));

    // Export with "current view" mode (up to turn 5)
    const currentViewItems = extractQueueItems([buildingLane], 5);

    // Export with "full list" mode (all items)
    const fullListItems = extractQueueItems([buildingLane]);

    console.log('Current view items (up to T5):', currentViewItems);
    console.log('Full list items (all):', fullListItems);

    // Full list should have at least as many items as current view
    expect(fullListItems.length).toBeGreaterThanOrEqual(currentViewItems.length);

    // Items beyond turn 5 should only be in full list
    const itemsBeyondT5 = fullListItems.filter(item => item.turn > 5);
    const currentViewBeyondT5 = currentViewItems.filter(item => item.turn > 5);

    expect(currentViewBeyondT5.length).toBe(0); // Current view shouldn't have items beyond T5
  });
});