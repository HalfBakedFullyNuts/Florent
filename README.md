# Infinite Conflict Planner

A deterministic build planner and turn simulator for Infinite Conflict, built with Next.js, React, TypeScript, and Vitest.

The app helps plan planet development across multiple production lanes, inspect future turns, manage queues, and export/share build orders.

The live website can be found here: florent-infiniteconflict.statichost.page

## Features

- Multi-planet planning with configurable resource abundance and space caps.
- Deterministic turn simulation with rewind/forward inspection through a horizontal timeline.
- Production lanes for buildings, ships, colonists, and research-compatible engine data.
- Queue actions for adding items, waits, cancellation, quantity changes, and reordering.
- Dependency and validation warnings for invalid or cascading queue changes.
- Planet dashboard for stocks, production, population, space, and housing pressure.
- Shareable URL/localStorage state encoded from command history.
- Queue export as plain text, Discord-friendly text, PNG image, or build-data JSON for game import, with selected-planet and all-planets export targets.
- Static export support for simple hosting.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Vitest and Testing Library
- html2canvas for image exports

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

```bash
npm run dev      # Start the local Next.js development server
npm run build    # Clean and build the static export
npm run start    # Start a Next.js production server
npm run lint     # Run Next.js linting
npm run test     # Run the Vitest test suite
```

`next.config.js` currently uses `output: 'export'`, so production builds emit static files into `out/`.

## Project Layout

```text
src/app/                    Next.js routes and top-level app page
src/components/             React UI components
src/components/ui/          Shared UI primitives
src/lib/game/               Game state, commands, selectors, persistence, logging
src/lib/sim/engine/         Framework-free deterministic simulation engine
src/lib/sim/rules/          Turn-order rules and constants
src/lib/sim/defs/           Game definition adapters and seed state
src/lib/export/             Build-order export formatters
src/test/fixtures/          Shared test fixtures
docs/                       Feature and troubleshooting docs
Architecture/               Design notes, tickets, and implementation plans
scripts/                    Data extraction/import helpers
public/                     Static assets
out/                        Generated static build output
```

## Simulator Architecture

The core simulation code lives under `src/lib/sim/` and is kept independent of React and Next.js. The UI talks to the planner through the orchestration layer in `src/lib/game/`:

- `commands.ts` mutates plans through a controlled API.
- `gameState.ts` manages planets and global state.
- `selectors.ts` produces read-only projections for the UI.
- `state.ts` provides timeline/state access.
- `urlState.ts` encodes and replays command history for sharing.

This split keeps the engine deterministic and testable while allowing the UI to inspect any turn without owning simulation rules directly.

## Data

Game definitions are stored in `src/lib/game/game_data.json`, with supporting CSV/source files in the repository root. Research data is available in `src/lib/game/research_data.json`. Data import helpers live in `scripts/`.

## Testing

Run all tests with:

```bash
npm run test
```

Tests cover the simulation engine, game state and selectors, export formatting, queue validation, multi-planet flows, and React components.

## Docker

Docker configuration is included:

```bash
docker compose up dev --build
docker compose run --rm test
```

See `DOCKER.md` for the full container workflow. Note that the main Next.js config currently targets static export; update the output mode if you need a standalone production server image.

## Useful Docs

- `DOCKER.md` - Docker setup and commands
- `LOGGING_GUIDE.md` - Runtime logging/debugging helpers
- `docs/EXPORT_TROUBLESHOOTING.md` - Export issue guide
- `docs/RESEARCH_IMPLEMENTATION.md` - Research implementation notes
- `Architecture/ARCHITECTURAL_DECISIONS.md` - Architecture rationale
- `Architecture/CoreLogicPseudocode.md` - Engine pseudocode
- `CLAUDE.md` - Guidance for AI coding assistants

## License

MIT
