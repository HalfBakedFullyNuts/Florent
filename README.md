# Infinite Conflict — Turn-Based Strategy Simulator

A deterministic build-order planner for the 4X MMORPG **Infinite Conflict**. Plan a planet's economy, queue structures / ships / colonists / research, scrub a turn slider through a 200-turn timeline, and share the plan via a compact URL.

Built with **Next.js 14 (App Router)**, **React**, **TypeScript**, **Tailwind**, and **Vitest**. Hosted as a static export on [StaticHost.eu](https://statichost.eu).

> **Status:** v0.1.4 — mid-migration from a simple build planner to a full turn-based simulation engine. The legacy code in `src/lib/game/` keeps the app working while the new engine is grown in `src/lib/sim/`.

---

## What it does

- **Deterministic turn engine.** Same inputs → same outputs, every turn, forever. Plans are reproducible and shareable.
- **Three production lanes.** Building → Ship → Colonist run in a strict per-turn order. Research is a fourth lane, gated by Research Points.
- **Activation-time pricing.** Resource, worker, and space costs are reserved when an item *activates* (leaves the pending queue), not when it's queued or completes. Pending items reserve nothing.
- **Auto-wait injection.** When a queued item depends on a prereq that isn't built yet, the engine inserts an explicit `isAutoWait` node so the wait is visible in the timeline.
- **Repacking.** Cancellations and reorders cause the queue to be rebuilt by replaying intent from earliest to latest, so gaps collapse cleanly.
- **Cascading cancellation.** Cancelling a prereq runs a simulated re-validation in a cloned state and surfaces every dependent item in a confirmation modal.
- **Multi-planet support.** Tab between planets; full state syncs to the URL.
- **Compact URL encoding.** Plans serialize to a short shareable URL fragment.
- **Image / debug export.** Export a screenshot of the planet board or copy the full debug state to the clipboard.
- **localStorage auto-save.** Browser refresh doesn't lose your plan.
- **Vertical turn slider with auto-jump.** Jump to the turn where the last queued building completes for instant feedback on a build order.

## Architecture (one-screen overview)

```
┌─────────────────────────────────────────────┐
│ UI (src/app, src/components)                │  Next.js, "use client"
├─────────────────────────────────────────────┤
│ Orchestration (src/lib/game)                │  GameStateContext → GameController
│   - Commands API (mutations)                │  Selectors (read-only projections)
│   - Timeline / snapshots                    │  URL + localStorage sync
├─────────────────────────────────────────────┤
│ Engine (src/lib/sim)                        │  Pure TS, framework-free
│   - types, validation, lanes                │  No React / DOM imports
│   - completions, outputs, turn              │
└─────────────────────────────────────────────┘
                  ▲
                  │
        src/lib/game/game_data.json   ← single source of truth for content
```

Three rules to remember:

1. **No React in `src/lib/game/`** (except the explicit `GameStateContext.tsx` orchestrator) and **no React anywhere in `src/lib/sim/`**.
2. **All mutations route through `GameController`.** No standalone wrapper functions.
3. **`game_data.json` is truth.** Never hardcode unit or structure definitions in components.

Full architectural rationale lives in [`Architecture/ARCHITECTURAL_DECISIONS.md`](Architecture/ARCHITECTURAL_DECISIONS.md).

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # Vitest
npm run lint
npm run build    # static export → ./out
```

Run a single test file:

```bash
npm run test src/lib/game/__tests__/queue-integrity.test.ts
npm run test -- --watch
npm run test -- -t "queue"
```

## Project layout

```
src/
  app/            Next.js App Router pages + tests
  components/     Presentational + container UI
  lib/
    game/         Orchestration layer + GameStateContext + game_data.json (legacy logic also lives here, being migrated)
    sim/          New deterministic engine (framework-free)
  test/fixtures/  Shared test scenarios

Architecture/     ADRs, design docs, tickets, UI specs
claudedocs/       Phase completion reports + dated bug analyses
docs/             Topical docs (research, export troubleshooting)
tickets/          Active bug tickets
```

## Versioning

Current version: **0.1.4**, declared in two places that must move together:

- `package.json` → `"version"`
- `src/app/page.tsx` → footer (`<div className="opacity-30 text-[10px]">v0.1.4</div>`)

Per project policy, **every delivered change bumps the patch version by 0.0.1** — no exceptions. See [`CHANGELOG.md`](CHANGELOG.md) for the version history and [`WORKLOG.md`](WORKLOG.md) for a chronological narrative of how the project got here.

## Hosting

Production builds deploy to StaticHost.eu. `next.config.js` sets `output: 'export'`; `statichost.yaml` defines the build command and output dir (`out`). Push to `main` and StaticHost picks it up.

A Docker setup is also available for local containerized work — see [`DOCKER.md`](DOCKER.md).

## Documentation map

- [`CLAUDE.md`](CLAUDE.md) — instructions for AI assistants (and a tight summary of the rules)
- [`CHANGELOG.md`](CHANGELOG.md) — version history (Keep a Changelog format)
- [`WORKLOG.md`](WORKLOG.md) — chronological project journal
- [`Architecture/`](Architecture/) — ADRs, pseudocode, test strategy, UI specs, tickets
- [`LLM_AND_DEV_GUIDELINES.md`](LLM_AND_DEV_GUIDELINES.md) — change-proposal template and review checklist
- [`LOGGING_GUIDE.md`](LOGGING_GUIDE.md) — runtime logging conventions
- [`DOCKER.md`](DOCKER.md) — local container setup

## License

MIT — see [`LICENSE`](LICENSE).

## Contributors

Created by **Wolfpack** for *Infinite Conflict*.
