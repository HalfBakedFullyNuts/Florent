# Florent - Infinite Conflict Simulator
## Project Presentation Overview

---

### What is Florent?

- **Turn-based strategy simulator** for the Infinite Conflict 4X MMORPG
- **Build planner tool** that helps players optimize their colony development
- **Deterministic simulation** - same inputs always produce same outputs
- Allows planning builds across multiple planets with different start times

---

### Problem It Solves

- Infinite Conflict has complex build orders with many dependencies
- Players need to plan resource production, housing, and unit production
- Travel time between planets means colonies start on different turns
- Manual planning is error-prone and time-consuming
- This tool simulates the entire build queue to catch mistakes early

---

### Core Features

- **Multi-planet support** - Manage multiple colonies with different start turns
- **Four production lanes**: Structures, Ships, Colonists, Research
- **Resource tracking**: Metal, Mineral, Food, Energy, Workers
- **Queue validation** - Warns about missing prerequisites or resources
- **Timeline scrubbing** - View state at any turn in the simulation
- **Shareable URLs** - Export/import game state via URL encoding

---

### Technical Architecture

**Three-Layer Design:**

1. **Simulation Engine** (`src/lib/sim/engine/`)
   - Pure TypeScript, framework-free
   - No React/DOM dependencies
   - Handles turn progression, resource calculations, completions

2. **Orchestration Layer** (`src/lib/game/`)
   - Commands API for mutations
   - State management with timeline/snapshots
   - Selectors for read-only UI projections

3. **UI Layer** (`src/components/`, `src/app/`)
   - Next.js 14 with React
   - Presentational components consume selectors
   - No game logic in UI code

---

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom "Pink Nebula" theme
- **Testing**: Vitest + React Testing Library
- **State**: Local React state (no global store by design)
- **Data**: JSON-driven game definitions (`game_data.json`)

---

### Data-Driven Design

- All game entities defined in `game_data.json`
- **15 unit types** (colonists, ships)
- **35+ structures** across tiers 1-3.5
- **Research tree** with prerequisites
- Cost system supports resources and unit costs
- Easy to update when game balance changes

---

### Key UI Components

| Component | Purpose |
|-----------|---------|
| `PlanetTabs` | Switch between colonies |
| `PlanetDashboard` | Resource/population overview |
| `HorizontalTimeline` | Scrub through turns |
| `TabbedItemGrid` | Add items to queue |
| `TabbedLaneDisplay` | View/manage queue entries |

---

### Development Practices

- **Test-Driven Development** (TDD) - Tests written before implementation
- **90%+ code coverage** target for engine code
- **Architectural Decision Records** (ADRs) for major changes
- **No hardcoded game data** - everything from JSON
- **Separation of concerns** - UI never implements game rules

---

### Current Status

- Core build planner: **Complete**
- Multi-planet support: **Complete**
- Research system: **In Progress**
- Full turn simulation engine: **Migration in progress**
- URL state persistence: **Complete**

---

### Future Roadmap

- Complete simulation engine migration
- Inter-planet resource transfers (cargo ships)
- Combat simulation
- Optimal build order suggestions
- Mobile-responsive UI improvements

---

### Project Structure

```
src/
├── app/                 # Next.js pages and routes
├── components/          # React UI components
│   ├── QueueDisplay/    # Queue visualization
│   ├── LaneBoard/       # Item selection grids
│   └── ui/              # Shared UI primitives
├── lib/
│   ├── game/            # Game logic and state
│   └── sim/             # New simulation engine
└── test/                # Test fixtures
```

---

### Running the Project

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run test         # Run test suite
npm run build        # Production build
```

---

### Key Takeaways

1. **Deterministic engine** enables reliable planning
2. **Separation of concerns** keeps code maintainable
3. **Data-driven design** makes updates easy
4. **TDD approach** ensures reliability
5. **Multi-planet support** matches real game complexity
