# Architecture Overview — Infinite Conflict Planner

This document gives a high-level overview of the project's architecture, how responsibilities are separated, and where to look for important pieces of the code.

Goals
- Small, component-driven UI using Next.js 14 (app router) and React 18.
- Separate deterministic game logic from UI so logic can be tested independently.
- Lightweight, test-first approach using Vitest and React Testing Library.

Tech stack
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Vitest + @testing-library/react for unit/integration tests

Top-level layout (on-disk)
- `src/app/` — Next.js application entry points, page components, layouts, error pages, global CSS.
  - `page.tsx` — main UI (client component), houses primary state and UI layout.
  - `layout.tsx` — root layout, preloads fonts and external styles.
  - `error.tsx`, `not-found.tsx` — app-level error pages.
- `src/components/` — small presentational and container components used by `page.tsx`.
- `src/lib/game/` — game logic, data managers, agent functions and domain types. This is intentionally decoupled from React to make it testable.
- `src/data/` — static JSON data (e.g., colonist types).
- `src/app/__tests__/`, `src/lib/game/__tests__/` — unit and integration tests.

Runtime responsibilities
- UI (React + Next): rendering, forms, user interactions, layout, dev-time instrumentation and logging.
- Game library (`src/lib/game`): pure or minimally imperative logic for enqueuing, costing, processing ticks. Tests rely on this to validate behavior without React.

Client vs Server
- Most pages that use React hooks are Client Components and must start with `"use client"` (e.g., `src/app/page.tsx`). Pure helpers and data managers in `src/lib/game` remain server/neutral (no hooks) so they can be imported from either context and tested without React.

State management
- State is handled primarily with React `useState` and local component state. The game/agent functions mutate and return structured results, and React is used to trigger re-renders (simple, explicit state updates).

Testing and verification
- Unit tests: `vitest` is configured. Tests live beside the logical modules (see `src/lib/game/__tests__`).
- UI tests: render pages/components with Testing Library under `src/app/__tests__`.

Build and run
- Dev: `npm run dev` (Next.js dev server)
- Test: `npm run test` (Vitest)
- Build: `npm run build` (Next.js production build)

Where to start reading
1. `src/lib/game/dataManager.ts` and `agent.ts` — core game logic and helpers.
2. `src/app/page.tsx` — main application UI, wiring game logic to components.
3. `src/components/*` — UI pieces used by the page.

Notes and conventions
- Add an ADR entry to `ARCHITECTURAL_DECISIONS.md` for every non-trivial architectural choice (see ADR template there).
- Prefer small, well-scoped functions in `src/lib/game` to keep logic testable.
- Keep side-effects isolated and minimal; prefer returning results so React can handle state updates.

Contact & context
- This repo originates from a UI spec and template called Florent. See `UI_SPEC_Florent.md` for design references.

