# LLM & Developer Guidance for Infinite Conflict Planner

This file contains short guidance for both LLMs (when generating prompts/specs) and developers working on the app. The goal is consistent, actionable artifacts that make collaboration smoother.

A. Guidance for LLMs producing prompts or spec sheets
- Be concise: start with a 1-2 sentence high-level objective.
- Provide explicit acceptance criteria: list 3–5 concrete checks or outputs the user can use to verify success.
- Avoid making environment assumptions: when referencing runtime (dev server, test command), include exact commands and file paths.
- When proposing code changes, include the files to change and a small patch (diff) focused on minimal edits.
- If the LLM recommends a structural change (new package, major refactor), also generate an ADR entry describing the change and reasoning.

Example spec structure for LLMs
1. Title (one line)
2. Objective (1 sentence)
3. Files affected (list)
4. Implementation steps (ordered)
5. Acceptance criteria (tests, UI behavior, example commands)
6. ADR summary (if the change affects architecture)

B. Guidance for human developers
- Add ADRs: Whenever you change the architecture (introduce a global store, server APIs, or change routing), add a short entry to `ARCHITECTURAL_DECISIONS.md`.
- Tests first: prefer adding a small unit test for new logic in `src/lib/game` or a UI test under `src/app/__tests__`.
- Keep game logic isolated: `src/lib/game` is the single source of truth for domain logic; UI should call into it, not reimplement rules.
- Use the prescribed scripts: `npm run dev`, `npm run build`, `npm run test`.
- When writing prompts for LLMs, use the spec structure above and include file context where possible.

C. LLM prompt template for developers to use
```
Goal: <one-line objective>
Context: <one-paragraph repo context or link to ARCHITECTURE.md>
Files: <files to change>
Steps: <ordered implementation steps>
Acceptance criteria:
- [ ] <unit test or expected output>
- [ ] <UI behavior or smoke check>
ADRs to add (1-2 sentences):
- <short ADR entry here>
```

D. Review & PR expectations
- Small PRs and a single responsibility per PR.
- Add changelog/reasoning and link to ADR if architectural impact.
- Include tests for logic changes and a brief manual test plan for UI changes.

E. Contact & escalation
- If an LLM-suggested change touches database, infra, or external APIs, escalate to a human reviewer before applying.

