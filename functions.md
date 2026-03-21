# Application Functions Reference

This document provides a reference for the core functions in the application, logically grouped by their module and purpose. Use the Quick Reference below to jump to specific sections.

## Quick Reference
- [Game Logic Core](#game-logic-core) (Timeline, Commands)
- [UI Selectors](#ui-selectors) (Data Projections, Summaries)
- [Data Management](#data-management) (Game Data, Validation)
- [Multi-Planet & Export](#multi-planet--export) (Global Commands, Exporting)
- [Legacy / Simulation](#legacy--simulation) (Agent, Tick Processing)

---

## Game Logic Core
Located in `src/lib/game/state.ts` and `src/lib/game/commands.ts`. These handle the core recursive state simulation and mutation.

### Timeline Class
- **`constructor(initialState: PlanetState)`**: Initializes the timeline with a starting state. Creates a fixed 200-turn array (lazily computed) to represent the future.
- **`getStateAtTurn(turn: number)`**: Retrieves the planet state at a specific turn index. Triggers lazy computation for that turn if it hasn't been calculated yet.
- **`mutateAtTurn(turn: number, mutation: (state) => void)`**: Applies a change (mutation) to the state at a specific turn and invalidates/recomputes all subsequent turns to reflect the change.
- **`nextTurn()`**: Advances the "current" view of the timeline by one turn.
- **`simulateTurns(count: number)`**: Advances the view by N turns, triggering lazy computation for the new range.

### GameController Class (Commands)
- **`queueItem(turn, itemId, qty)`**: Tries to add an item (structure/unit) to the pending queue of a lane at a specific turn. Validates prerequisites, costs, and queue depth.
- **`queueWaitItem(turn, laneId, waitTurns)`**: Adds a "Wait" block to a lane, pausing production for N turns without consuming resources.
- **`cancelEntry(turn, laneId)`**: Removes a pending item or cancels an active item in a lane. For active items, it refunds resources, releases workers, and clears the slot.
- **`reorderQueueItem(turn, laneId, entryId, newIndex)`**: Moves a pending item to a new position in the queue. Can also move *active* items by deactivating them (refunding costs) and placing them back into the pending queue.
- **`cancelEntryByIdSmart(turn, laneId, entryId)`**: Searches the timeline starting from the current turn to find and cancel an item, even if it has moved due to simulation updates.

---

## UI Selectors
Located in `src/lib/game/selectors.ts`. Pure functions that derive view data from the game state for React components.

- **`getPlanetSummary(state)`**: aggregates the entire planet state (resources, population, buildings, etc.) into a simple object for the Dashboard UI.
- **`getLaneView(state, laneId)`**: Constructs a view of a specific production lane (Building, Ship, etc.), merging completed history, active items, and the pending queue into a single time-ordered list.
- **`getWarnings(state)`**: returns a list of warnings (e.g., "Housing full", "Negative Energy", "No Food") based on current resource trends and caps.
- **`canQueueItem(state, itemId, qty)`**: Helper for the UI to check if an item *can* be queued (validates costs/prereqs) without actually queuing it. returns an allowed boolean and reason.
- **`getFirstEmptyTurns(state, current, max)`**: Scans forward to find the first turn where production lanes become idle, helping the UI suggest where to queue next.

---

## Data Management
Located in `src/lib/game/dataManager.ts`. Handles loading and validating static game data (units, structures).

- **`GameDataService.getStructureById(id)`**: Retrieves the full static definition of a structure (costs, effects, production) by its ID.
- **`GameDataService.getUnitById(id)`**: Retrieves the full static definition of a unit (ship, soldier, etc.) by its ID.
- **`validateRawData(raw)`**: Runs runtime validation on the imported `game_data.json` to ensure it matches the expected schema (caught at startup).

---

## Multi-Planet & Export
Located in `src/lib/game/commands.ts` (extended) and `src/lib/export/multiPlanetExporter.ts`.

- **`enqueueBuildingForPlanet(gameState, planetId, ...)`**: Wrapper around `GameController` to execute a queue command specifically on one planet within the multi-planet `GameState`.
- **`queueResearch(gameState, itemId)`**: Global command to queue research. Automatically calculates the earliest turn it can start based on global Research Point generation.
- **`exportGameState(gameState)`**: Generates a text-based summary of all build queues and research orders for sharing/saving.
- **`exportGameStateDiscord(gameState)`**: Generates a markdown-formatted table of the build order suitable for pasting into Discord.

---

## Legacy / Simulation
Located in `src/lib/game/agent.ts`. Contains lower-level simulation logic and legacy adapters.

- **`processTick(player, planetAbundances, delta)`**: Executes one simulation step. Applies production (add resources), consumption (remove resources), and decrements build timers.
- **`completeQueueItem(player, qi)`**: Called when a build timer reaches zero. Adds the finished item to `ownedBuildings` or `unitCounts` and applies its permanent effects (e.g., +Housing).
- **`enqueueItem(player, itemId, type)`**: Legacy/Agent function to queue items. largely superseded by `GameController` for the main UI, but may be used by the AI agent logic.
