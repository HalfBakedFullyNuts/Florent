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

Initial entries

2025-10-11 — Use Next.js App Router with Client Components for interactive UI
We chose Next.js 14 app-router and marked `src/app/page.tsx` as a Client Component to enable React hooks and local state for the main interactive planner UI.

2025-10-11 — Keep game logic separated in `src/lib/game`
Game rules and agents live in `src/lib/game` so they can be tested independently of the UI and reused in non-React contexts.

2025-10-11 — Use plain React state (useState) and avoid global stores for now
To keep the code simple and easy to reason about, local `useState` is used for player and UI state; agent functions mutate state and React is used to refresh views.

Process requirement (new)
- All contributors must add an ADR entry to this file whenever they make a non-trivial architectural decision (for example introducing a global store, adding server-side APIs, or changing how game logic is persisted).

