# Architectural Decision Records (ADRs)

This file tracks short (1-2 sentence) Architectural Decision Records (ADRs). Each entry should include: the date, a one-line title, and a 1-2 sentence summary of why the decision was made.

Conventions
- Keep entries short and factual.
- Add a new entry at the top for each decision (most recent first).
- If a decision needs more context, link to a supporting issue, PR, or a longer markdown file in `docs/`.

Template for an ADR entry
```
YYYY-MM-DD — Title
Short rationale (1-2 sentences).
```

## Recent Decisions - Turn-Based Simulator Implementation

2026-05-04 — Binary Share-Link Encoding
New share and debug URLs use a v3 binary-packed payload with a `b3.` prefix to reduce URL length. Legacy v1/v2 compressed JSON links remain decodable so existing shared links and cached saves continue to load.

2026-05-04 — Shared-Link Metadata and Separate Shared Saves
Shared build links carry optional name/author metadata inside the compact URL payload so ownership can be shown without changing command replay. Opened shared links are stored in a dedicated IndexedDB `shared` store, keeping other players' lists separate from user-managed saves.

2026-05-04 — Global Research and Configurable Colony Starts
Research points and the research lane are modeled as global session state while research labs and scientists remain planet-local. Added-planet starting population and starter production structures are persisted in compact URL commands so edited colony starts replay deterministically without changing activation-time queue costs.

2026-04-30 — Activation-Time Pricing for All Costs
Resource and RP costs are deducted at activation time (not queue time), aligning with workers and space. Queueing is intent registration only — pending items affect no stocks. The unified queue gate (`canQueue`) accepts any item whose costs are reachable via current stocks plus net production, and rejects only when prereqs are absent, planet limit is met, energy projection turns negative, or a required resource has non-positive net production. Auto-wait items are injected into a queued item's lane when its prereq is queued but not yet built (using `calculatePrereqWaitTurns`). Lane priority (building > ship > colonist > research) is implicit in `LANE_ORDER` traversal: each lane's `clampBatchAtActivation` sees stocks already debited by prior lanes that turn.

2026-03-02 — Simulated Dependency Validation for Cancellation
To prevent complex state-unwinding bugs when a user cancels a prerequisite building (e.g., cancelling a Shipyard while a Freighter is globally queued later), we avoid writing manual dependency graph logic. Instead, `getDependentQueueItems` creates a fast detached `cloneState()`, splices out the target item, and re-runs the existing standard `validateAllQueueItems` engine. Any item throwing a `REQ_MISSING` error in the simulation is dynamically flagged in a `DependencyWarningModal` for cascading cancellation.

2026-03-02 — Auto-Collapsing Timelines and Explicit Wait Items
To improve player UX regarding timeline gaps, we introduced `repackQueue()`. Rather than calculating exact turn values mathematically when gaps open up (e.g., from cancellations or reorders), the engine extracts all pending queue items, scrubs the timeline clean, and simulates the reconstruction chronologically from earliest to latest. If a prerequisite dynamically fails (e.g., waiting for population growth), it systematically advances the `cursorTurn` until valid and explicitly injects an `isAutoWait` entry. This elegantly surfaces implicit waiting periods directly into the visual queue without modifying core rule implementations.

2026-03-02 — Global Queue State Independence
The `viewTurn` (turn slider) was decisively separated from queue mutation logic. All queue actions (`queueItem`, `cancelItem`, `reorderItem`) now universally execute upon Turn 1 of the simulation, ensuring the `Planet Queue` view represents the *Master Plan* traversing the full 200 turns, rather than artificially hiding queued items if the user slides the VCR backwards in time. The UI adjusts the visual node status (`pending`, `active`, `completed`) dynamically relative to the `viewTurn`.

2026-03-02 — Implement GameStateContext to replace deep prop drilling
Deep prop drilling of state and callbacks in `src/app/page.tsx` was replaced with a `GameStateContext` under `src/lib/game/GameStateContext.tsx` to handle multi-planet URL syncing, `GameController` instances, and timeline state memoization securely without massive component payloads.

2026-03-02 — Enforce GameController usage over legacy wrapper functions
Legacy queue wrapper functions in `src/lib/game/agent.ts` (e.g., `enqueueUnit`, `cancelQueueItemLegacy`) were permanently removed to strictly enforce utilizing the correct unified timeline queue mechanisms inside `GameController`.

2026-03-02 — Enable fast-forwarding on empty timeline simulation turns
Timeline calculations explicitly compute net-outputs per turn, accelerating processing massively by caching the exact same turn data forward without executing loops if production, queue lengths, and worker growths are perfectly zero (`isStableState`).

2025-10-26 — Auto-advance to last building completion in queue
When buildings are queued, the UI automatically advances to the turn when the last building in the queue completes, showing the cumulative planet state after all queued work finishes. This provides immediate feedback on the full impact of queuing decisions.

2025-10-26 — Continuous timeline display for queue scheduling
Pending items in the queue display a projected continuous timeline (e.g., T1-T4, T5-T8, T9-T12) showing when each item will occupy the production lane, calculated by sequentially allocating time slots based on item durations.

2025-10-26 — Same-turn completion for buildings
Buildings apply their effects (housing, space capacity, production) on the same turn they complete (turnsRemaining reaches 0), not the following turn. This ensures resource outputs immediately reflect new structures. Ships retain next-turn completion via buffer.

2025-10-26 — Turn tracking in WorkItem lifecycle
WorkItems now track queuedTurn, startTurn, and completionTurn to support accurate timeline displays and history. This enables showing when items were queued, when they activated, and when they completed throughout their lifecycle.

2025-10-26 — Completion history for visual queue persistence
Completed items remain visible in lane queues with muted styling rather than disappearing, creating a visual history of construction progress. This helps players track what has been built during the session.

2025-10-25 — Parallel directory structure during migration
We will create `src/lib/sim/` alongside existing `src/lib/game/` to allow gradual migration without breaking existing functionality, then deprecate old code once new engine is validated.

2025-10-25 — Completion buffer implementation using Map
Completion buffers will use Map<turn, WorkItem[]> to queue deferred completions, providing O(1) access for turn-keyed operations and clear separation of same-turn vs next-turn completions.

2025-10-25 — Adapter pattern for existing game data
Rather than rewriting game_data.json, we'll create adapters to transform existing data structures to new ItemDefinition format, preserving backward compatibility while enabling new engine.

2025-10-25 — Three-lane architecture with strict ordering
Building → Ship → Colonist lane execution order ensures resource contention is resolved deterministically, with earlier lanes having priority for resources and workers.

2025-10-25 — Queue-time validation vs activation-time clamping
Static constraints checked at queue time (prerequisites, energy forward-check), dynamic constraints (resources, workers) handled via clamping at activation, keeping items pending if resources insufficient.

2025-10-25 — Framework-free engine with orchestration layer
Pure TypeScript engine in `src/lib/sim/engine/` with no UI dependencies, accessed only through `src/lib/game/commands.ts` orchestration layer to maintain separation of concerns.

2025-10-25 — Use game_data.json as authoritative source
All unit and structure definitions come from existing game_data.json without modification, adapter interprets the format for engine consumption rather than transforming it.

2025-10-25 — Worker occupation values as literal
Workers_occupied field uses literal values (5000 = 5000 workers), not percentages or scaled values, matching the game's actual worker requirements.

2025-10-25 — Colonist training reserves multiple workers
Soldier training reserves 10 workers (returns 9, converts 1), scientist reserves 20 (returns 19, converts 1), implementing the "training squad" concept where multiple workers are occupied but only one converts.

Initial entries

2025-10-11 — Use Next.js App Router with Client Components for interactive UI
We chose Next.js 14 app-router and marked `src/app/page.tsx` as a Client Component to enable React hooks and local state for the main interactive planner UI.

2025-10-11 — Keep game logic separated in `src/lib/game`
Game rules and agents live in `src/lib/game` so they can be tested independently of the UI and reused in non-React contexts.


Process requirement (new)
- All contributors must add an ADR entry to this file whenever they make a non-trivial architectural decision (for example introducing a global store, adding server-side APIs, or changing how game logic is persisted).
