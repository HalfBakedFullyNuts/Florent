# Agent Instructions

This document provides instructions for AI agents and developer assistants (like Claude, GitHub Copilot) when writing or modifying code in this project.

If you are an AI reading this, please apply these constraints to your plans:

## 1. Strictly use GameStateContext for React Components
Do not use "prop drilling" (passing state and actions down through multiple component layers).
Instead, any UI component that needs access to the global game state or needs to dispatch a mutation command MUST use:
```tsx
import { useGameState } from '../lib/game/GameStateContext';

// Inside component:
const { gameState, controller, viewTurn, setViewTurn, handlePlanetSwitch /* etc */ } = useGameState();
```
The context handles caching the expensive `GameController` internally and manages the active planet seamlessly.

## 2. Strictly use GameController for State Mutations
Do NOT use legacy helper wrapper functions previously found in `src/lib/game/agent.ts` (e.g., `enqueueUnit`, `cancelQueueItemLegacy`). These have been purged.
All state/queue interactions from the UI layer must route through the `controller` object derived from `useGameState()`.
Examples:
- `controller.queueItem(viewTurn, itemId, quantity)`
- `controller.cancelEntryByIdSmart(viewTurn, laneId, entryId)`
- `controller.reorderQueueItem(viewTurn, laneId, entryId, newIndex)`

## 3. Respect the Timeline Caching strategy (`isStableState`)
The core timeline system in `src/lib/game/state.ts` uses an aggressive look-ahead caching feature named `isStableState()`.
If you are adding a new mechanic that introduces continuous changes (e.g. passive resource generation, worker decay, automated queue fulfillment):
YOU MUST update `isStableState()` to return `false` if your new mechanic causes state to change every turn without user input. If you fail to do this, the engine will incorrectly freeze the UI state calculations assuming nothing is changing. Currently, the check verifies that production `delta === 0` and worker growth `< 1`.

## 4. Architectural Checks
Before planning larger refactors, please review `ARCHITECTURE_DECISIONS.md` to avoid reverting previous structural choices (such as our choice to avoid Redux/Zustand in favor of a specialized Context Provider, or our choice of strict 3-lane determinism over ad-hoc timestamps).
