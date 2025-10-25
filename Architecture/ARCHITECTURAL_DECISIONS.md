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

2025-10-11 — Use plain React state (useState) and avoid global stores for now
To keep the code simple and easy to reason about, local `useState` is used for player and UI state; agent functions mutate state and React is used to refresh views.

Process requirement (new)
- All contributors must add an ADR entry to this file whenever they make a non-trivial architectural decision (for example introducing a global store, adding server-side APIs, or changing how game logic is persisted).

