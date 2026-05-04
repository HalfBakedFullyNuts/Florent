# Code Review Work Items - Global Research Feature Set

Date: 2026-05-04

Scope reviewed:
- Global research and global RP refactor.
- PL based planet limit handling.
- Late-start added planets and inactive planet fallback UI.
- Added-planet starting configuration and editing.
- Reset-all planet behavior.
- Infinity max-queue button and scientist/soldier default quantities.
- URL replay/export behavior touched by the above.

This is a high-level integration review. It focuses on correctness, performance, replayability, and player-visible consistency.

## Finding Summary

| Severity | Work item | Primary files |
| --- | --- | --- |
| P1 | Replace linear planet-limit future scan with deterministic research milestones | `src/lib/game/globalResearch.ts` |
| P1 | Remove fixed T199/T200 assumptions from late-start planet queue operations | `src/app/page.tsx` |
| P2 | Define reset-all semantics for global research and make replay match | `src/lib/game/gameState.ts`, `src/lib/game/urlState.ts`, `src/app/page.tsx` |
| P2 | Make the infinity max-queue button follow the same availability contract as normal queueing | `src/components/LaneBoard/TabbedItemGrid.tsx` |
| P3 | Keep added-planet numeric text inputs as editable drafts before coercion | `src/components/AddPlanetModal.tsx` |

## Work Item 1 - Replace Linear Planet-Limit Future Scan

### Problem

`getEarliestPlanetStartTurn` scans every turn from `fromTurn` to `RESEARCH_PLAN_MAX_TURN` and calls `getPlanetLimitAtTurn` on each iteration:

- `src/lib/game/globalResearch.ts:269`
- `src/lib/game/globalResearch.ts:274`
- `src/lib/game/globalResearch.ts:275`
- `src/lib/game/globalResearch.ts:276`

`getPlanetLimitAtTurn` calls `getGlobalResearchAtTurn`, which simulates research from the start of the session to the requested turn:

- `src/lib/game/globalResearch.ts:256`
- `src/lib/game/globalResearch.ts:266`

That means a single "can I add planet 5?" check can become up to 1,000,000 repeated research simulations. This is not acceptable in the UI path. It also matches the reported slowdown around additional planets and auto-wait calculations.

### Target Behavior

Planet limit lookup should be derived from a small list of PL completion milestones:

- Base limit is 4.
- Completed PL research applies immediately.
- Scheduled PL research applies on its completion turn.
- If PL6 completes on T48, planet 5 and planet 6 are allowed on T48.
- If no matching PL is completed or scheduled, the answer is `null` immediately, not after a million-turn scan.

### Implementation Plan

1. Add a selector in `src/lib/game/globalResearch.ts`, for example:

   ```ts
   export interface PlanetLimitMilestone {
     turn: number;
     limit: number;
     researchId?: string;
   }

   export interface GlobalResearchPlanView {
     snapshot: GlobalResearchSnapshot;
     completionTurns: Map<string, number>;
     planetLimitMilestones: PlanetLimitMilestone[];
   }

   export function getGlobalResearchPlanView(gameState: GameState): GlobalResearchPlanView;
   ```

2. Implement the selector by simulating the global research plan once with `untilLaneSettled`.

3. Build `completionTurns` from `snapshot.lane.completionHistory`.

4. Build `planetLimitMilestones` from:

   - `gameState.globalResearch.completed`, using turn `1` or a documented `completedTurn` fallback if historical turn data does not exist.
   - Simulated completion history entries whose item definitions have `effectsOnComplete.planet_limit`.

5. Sort milestones by `turn ASC`, then `limit ASC`, then stable insertion order.

6. Replace `getEarliestPlanetStartTurn` with milestone lookup:

   - If `planetNumber <= BASE_PLANET_LIMIT`, return `Math.max(1, fromTurn)`.
   - Compute the effective limit at `fromTurn`; if sufficient, return `fromTurn`.
   - Return the first milestone at or after `fromTurn` where the running limit reaches `planetNumber`.
   - Return `null` if none exists.

7. Replace `getPlanetLimitAtTurn` with a milestone-based lookup, or route it through the same selector so there is one source of truth.

8. Add a no-progress guard to global research planning:

   - If the lane is blocked by unmet prerequisites that are not queued and cannot become completed, stop planning.
   - If required stock can never be reached because global RP output is zero and no future scientist output changes exist, stop planning.
   - Return the partial plan without scanning to `RESEARCH_PLAN_MAX_TURN`.

9. Update callers in `src/app/page.tsx` so the add-planet modal uses the milestone result.

### Tests

Add or update tests in `src/lib/game/__tests__/globalResearch.test.ts` and `src/lib/game/__tests__/gameState.test.ts`:

1. No PL queued:
   - Four planets exist.
   - `getEarliestPlanetStartTurn(gameState, 5, 49)` returns `null`.
   - The test should not require simulating to the max turn.

2. PL6 queued and completes T48:
   - `getPlanetLimitAtTurn(gameState, 47)` is 4.
   - `getPlanetLimitAtTurn(gameState, 48)` is 6.
   - `getEarliestPlanetStartTurn(gameState, 5, 1)` returns 48.
   - `getEarliestPlanetStartTurn(gameState, 6, 49)` returns 49.

3. First three added planets:
   - Planet numbers 2, 3, and 4 are accepted at arbitrary valid start turns without PL research.

4. Blocked research plan:
   - A PL item with an unmet, unscheduled prerequisite does not cause a long future scan.
   - `getEarliestPlanetStartTurn` returns `null`.

## Work Item 2 - Remove Fixed T199/T200 Assumptions

### Problem

Late-start planets can have a valid timeline beyond world T199. The code already computes `planetTimelineEndTurn`, but several queue operations still use `totalTurns - 1` or literal `199`:

- Auto-advance after queueing uses `controller.getStateAtTurn(totalTurns - 1)` and clamps to `totalTurns - 1`.
  - `src/app/page.tsx:587`
  - `src/app/page.tsx:593`
- Cancellation uses `const maxTurn = totalTurns - 1`.
  - `src/app/page.tsx:657`
- Dependency analysis uses `controller.getStateAtTurn(199)`.
  - `src/app/page.tsx:804`
- Max quantity calculation uses `controller.getStateAtTurn(199)`.
  - `src/app/page.tsx:900`

For a planet that starts at T46, the 200-turn planning horizon ends at T245. Looking at T199 misses valid future queue entries and can produce false dependency checks, wrong max quantities, and wrong auto-jumps.

### Target Behavior

All planet-local queue reads and mutations should use the active planet's world-turn horizon:

```ts
planetPlanStartTurn = currentPlanet.startTurn;
planetPlanEndTurn = currentPlanet.startTurn + totalTurns - 1;
```

Only navigation should clamp to the final simulated world turn. The displayed queue entry should still show its computed completion turn even when completion exceeds the simulator's navigation limit.

### Implementation Plan

1. Introduce a small helper near the existing timeline calculations in `src/app/page.tsx`:

   ```ts
   function getPlanetPlanEndTurn(planet: ExtendedPlanetState | null, totalTurns: number): number {
     return planet ? planet.startTurn + totalTurns - 1 : totalTurns;
   }
   ```

   Or reuse the existing `planetTimelineEndTurn` consistently.

2. Replace these reads with `planetTimelineEndTurn`:

   - `controller.getStateAtTurn(totalTurns - 1)` in auto-advance.
   - `Math.min(endTurn + 1, totalTurns - 1)` in auto-advance.
   - `const maxTurn = totalTurns - 1` in cancellation.
   - `controller.getStateAtTurn(199)` in dependency analysis.
   - `controller.getStateAtTurn(199)` in max quantity calculation.

3. Audit the rest of `src/app/page.tsx` for hardcoded `199`, `200`, and `totalTurns - 1`.

   - Keep `200` only where it truly means "number of simulated turns".
   - Use `planetTimelineEndTurn` where it means "last world turn for this planet".

4. Add a named navigation clamp helper:

   ```ts
   function clampToPlanetTimeline(turn: number, planet: ExtendedPlanetState, totalTurns: number): number {
     return Math.max(planet.startTurn, Math.min(turn, planet.startTurn + totalTurns - 1));
   }
   ```

5. Use the same simulated display source for:

   - Queue display.
   - Auto-advance target lookup.
   - Cancel dependency analysis.
   - Max-quantity lookup.

6. Confirm that inactive planet fallback still shows a non-crashing message when `viewTurn < currentPlanet.startTurn`.

### Tests

Add tests covering a planet that starts at T46:

1. Queue item with a completion after T199:
   - It appears in queue order normally.
   - It displays its real completion turn.
   - Clicking the completion turn navigates no later than T245.

2. Dependency analysis:
   - Queue a prerequisite and dependent item whose dependency lands after T199.
   - Cancel the prerequisite.
   - The warning modal or cascade logic sees the dependent item.

3. Max quantity:
   - On a T46 planet, max quantity is calculated from the T245 state, not T199.

4. Auto-advance:
   - Queue Research Lab then Scientist.
   - Scientist start/completion are derived from the simulated future snapshot.
   - Auto-jump uses the same delayed completion turn as the displayed queue.

## Work Item 3 - Define Reset-All Semantics For Global Research

### Problem

`handleResetQueue` now calls `resetToHomeworld`, records `xa`, and resets view state:

- `src/app/page.tsx:958`
- `src/app/page.tsx:963`
- `src/app/page.tsx:969`

`resetToHomeworld` removes added planets and rebuilds the homeworld, but it spreads the existing game state and does not clear `globalResearch`:

- `src/lib/game/gameState.ts:322`
- `src/lib/game/gameState.ts:323`
- `src/lib/game/gameState.ts:324`
- `src/lib/game/gameState.ts:325`

URL replay applies `xa` by calling the same function:

- `src/lib/game/urlState.ts:613`
- `src/lib/game/urlState.ts:614`

After the global research refactor, research is a global queue. Leaving global research queued/completed while resetting planets to a fresh homeworld is a mixed state. A fresh T1 homeworld can inherit global unlocks, RP stock, or pending research from the pre-reset plan.

### Target Behavior

The product must define one of these two behaviors explicitly:

1. Reset queue means reset the full plan:
   - Homeworld queue resets.
   - Added planets are removed.
   - Global research lane, global RP stock, and completed global research reset.

2. Reset planets means reset planets only:
   - Global research is intentionally preserved.
   - Button label and command name should not imply a full queue reset.

The first behavior is the safer default because the UI calls this a queue reset and research is now a queue.

### Implementation Plan

1. Prefer the full-plan reset behavior unless product direction says otherwise.

2. Add a helper in `gameState.ts`:

   ```ts
   function createInitialGlobalResearchState(): GameState['globalResearch'] {
     return {
       stock: 0,
       lane: {
         id: 'research',
         active: null,
         pendingQueue: [],
         completed: [],
         completionHistory: [],
         maxQueueDepth: 9999,
       },
       completed: [],
     };
   }
   ```

3. Use the helper in both `createInitialGameState` and `resetToHomeworld`.

4. If preserving research is intentionally desired:

   - Rename `recordResetAllPlanets` or update comments to state it preserves research.
   - Update UI copy so players are not told the queue was reset when global research remains.

5. Update replay:

   - `xa` should reproduce exactly the same reset semantics as the button.
   - Add a backward compatibility note if old URLs relied on `xa` preserving global research.

6. Clear any transient UI state tied to global research after reset:

   - Research lane validation.
   - Cascade warnings.
   - Export snapshot if open.

### Tests

Add tests in `src/lib/game/__tests__/gameState.test.ts` and URL replay tests:

1. Queue global research, add a planet, then reset:
   - Only homeworld remains.
   - Global research pending queue is empty.
   - Global research completion history is empty.
   - Global completed IDs are empty.
   - Global RP stock is 0.

2. Replay `qr`, `p`, `xa`:
   - Replayed state matches button behavior.

3. Replay `qr`, `xa`, `qr`:
   - Research queued after reset is retained.
   - Research queued before reset is removed.

## Work Item 4 - Fix Infinity Max-Queue Availability Contract

### Problem

Normal queueing allows soft-wait items:

- `src/components/LaneBoard/TabbedItemGrid.tsx:214`
- `src/components/LaneBoard/TabbedItemGrid.tsx:216`
- `src/components/LaneBoard/TabbedItemGrid.tsx:217`
- `src/components/LaneBoard/TabbedItemGrid.tsx:223`

The infinity button only uses `validation.allowed`:

- `src/components/LaneBoard/TabbedItemGrid.tsx:228`
- `src/components/LaneBoard/TabbedItemGrid.tsx:229`
- `src/components/LaneBoard/TabbedItemGrid.tsx:230`

So the normal `+` button can queue an item that must wait for future resources/prerequisites, while the infinity button may reject the same item even though the card is visibly queueable. That is inconsistent behavior.

### Target Behavior

The infinity button must have an explicit contract:

- Option A: "Max now"
  - Only queues the maximum amount that can activate immediately.
  - Disabled or clearly unavailable when `allowed === false`.
  - Normal `+` can still queue eventual items.

- Option B: "Max eventually"
  - Mirrors normal queueing.
  - Uses `canQueueEventually` where available.
  - Queues the largest quantity that the engine says can eventually start.

The user wording was "maximum amount at that time", so Option A is probably the intended behavior. If so, the button state must be driven by `allowed`, not merely `canQueueEventually`.

### Implementation Plan

1. Extract a pure helper:

   ```ts
   function getMaxImmediateQueueQuantity(
     itemId: string,
     canQueueItem: (itemId: string, quantity: number) => QueueValidation
   ): number
   ```

2. Keep the binary search, but document that it uses immediate validation.

3. Update button enabled/disabled state:

   - Normal `+` uses `canQueueEventually`.
   - Infinity uses `allowed`.
   - The infinity tooltip/error should say why max-now is unavailable.

4. If Option B is selected instead:

   - Rename the helper to `getMaxEventualQueueQuantity`.
   - Use `validation.canQueueEventually ?? validation.allowed`.
   - Make sure the engine can produce a real start turn for the resulting quantity before accepting it.

5. Keep the default quantity changes:

   - Scientist default remains 100.
   - Soldier default remains 100.
   - Other items remain 1.

### Tests

Add component or helper tests:

1. `+` queues a soft-wait item when `allowed === false` and `canQueueEventually === true`.

2. Infinity is disabled or errors consistently for the same item under Option A.

3. Infinity queues the maximum immediately allowed quantity when enough stock/housing exists.

4. Scientist and soldier quantity inputs initialize/reset to `100`.

5. Other item quantity inputs initialize/reset to `1`.

## Work Item 5 - Keep Added-Planet Numeric Inputs Editable

### Problem

The added-planet starting configuration is represented in the UI, but the numeric text inputs immediately coerce user input into numbers:

- `src/components/AddPlanetModal.tsx:150`
- `src/components/AddPlanetModal.tsx:153`
- `src/components/AddPlanetModal.tsx:157`
- `src/components/AddPlanetModal.tsx:165`
- `src/components/AddPlanetModal.tsx:416`
- `src/components/AddPlanetModal.tsx:417`
- `src/components/AddPlanetModal.tsx:432`
- `src/components/AddPlanetModal.tsx:433`

Because the component stores only normalized numbers, temporary edit states like an empty field are collapsed to `0` immediately. That is serviceable, but it is not a clean text-input implementation. It also makes it harder to show field-specific validation before commit.

### Target Behavior

Numeric fields should behave like text inputs while editing and normalize only when applying or blurring:

- Empty field can remain empty during editing.
- Non-digit characters are rejected or stripped predictably.
- On blur or submit, empty means default or 0 according to product choice.
- Saved `PlanetStartingSettings` remains normalized and non-negative.

### Implementation Plan

1. Add draft string state separate from `PlanetStartingSettings`:

   ```ts
   const [startingDraft, setStartingDraft] = useState({
     workersTotal: String(starting.workersTotal),
     structures: {
       metal_mine: String(starting.structures.metal_mine),
       mineral_extractor: String(starting.structures.mineral_extractor),
       farm: String(starting.structures.farm),
       solar_generator: String(starting.structures.solar_generator),
     },
   });
   ```

2. Keep `starting` as the normalized committed model.

3. Update draft on keystroke without forcing empty to `0`.

4. On blur:

   - Parse draft.
   - Clamp to non-negative integer.
   - Update `starting`.
   - Rewrite draft to the normalized string.

5. On submit:

   - Normalize all draft values.
   - Pass normalized `starting` into `onAddPlanet`.

6. When applying "Duplicate Homeworld":

   - Update both committed state and draft strings.

7. When opening the modal for edit:

   - Seed both committed state and draft strings from `initialConfig`.

### Tests

Add component tests if the project test setup supports them:

1. Clearing a starting-pop input leaves the field visually empty while focused.

2. Blurring an empty field normalizes to the product-defined fallback.

3. Duplicate Homeworld updates all draft fields and saved values.

4. Editing an added planet preserves existing start settings until changed.

5. Submit saves normalized integers for population and structures.

## Verification After Fixes

Run these commands after implementing the work items:

```powershell
npm.cmd run lint
npm.cmd run test -- --run
npm.cmd run build
```

Targeted tests to run while iterating:

```powershell
npm.cmd run test -- src/lib/game/__tests__/globalResearch.test.ts --run
npm.cmd run test -- src/lib/game/__tests__/gameState.test.ts --run
npm.cmd run test -- src/lib/game/__tests__/multi-planet-integration.test.ts --run
```

Manual smoke checks:

1. Queue PL6 to complete on T48.
2. Create four planets.
3. At T49, add planet 5 and confirm it starts no earlier than T48.
4. Try adding planet 5 with no PL queued and confirm the error appears immediately.
5. Add a planet at T46, drag the turn slider before T46, and confirm the app shows the unavailable state without crashing.
6. On the T46 planet, queue items that complete after T199 and confirm queue order, click navigation, cancellation, and max quantity all use the T245 horizon.
7. Queue a soft-wait unit and compare normal `+` behavior with infinity behavior.
8. Reset queue and confirm the intended global research reset/preserve behavior.
