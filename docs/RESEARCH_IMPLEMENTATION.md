# Research System Implementation (TICKET-7)

## Overview
This document outlines the implementation of the Research Points (RP) and Research Lane system.

## Completed Work

### 1. ✅ Data Extraction from CSV
- Successfully extracted 36 research items from the CSV file
- Created `scripts/extract-research-data.js` to parse the CSV
- Generated `src/lib/game/research_data.json` with all research items
- Research includes:
  - Basic research (Planet Management, Resource Collection, Fleet Technology)
  - Planet Limit increases (PL 6 through PL 24)
  - Structure/unit unlocks (Destroyer, Cruiser, Battleship, etc.)
  - Technology improvements (Mass Production, Land Enhancement, etc.)

### 2. ✅ Research Data Structure
Each research item has:
```json
{
  "id": "planet_management",
  "name": "Planet Management",
  "tier": 1,
  "rpCost": 100,              // Research Points cost
  "turnsToComplete": 24,       // Duration in turns
  "prerequisites": [],         // Required completed research
  "effects": {                 // What happens when completed
    "planetLimit": 6,          // For PL research
    "unlocksResearch": [...],  // Enables other research
    "unlocksStructure": "...", // Enables structures/units
  }
}
```

## Implementation Decisions

### Architecture Decisions

1. **Research as 4th Lane**
   - Research will be a 4th lane with special rules:
   - Lane capacity = 1 (only one research active at a time)
   - Global lane (shared across all planets in TICKET-8)
   - Uses RP resource instead of standard resources

2. **Research Points Production**
   - Scientists produce 1 RP per scientist per turn
   - RP accumulates globally (not per-planet)
   - RP is consumed when queueing research

3. **Planet Limit System**
   - Starting planet limit: 4
   - Increased through PL research (PL 6 → limit 6, etc.)
   - Stored in PlayerState as `planetLimit` field
   - Displayed in planet dashboard

4. **Research Prerequisites**
   - Three types of prerequisites:
     1. Direct research requirements (e.g., PL 6 requires Planet Management)
     2. Structure requirements (some units need research + structures)
     3. Completed research state tracking

5. **UI Integration**
   - Add "Research" tab to queue display
   - Show RP and RP/turn in resource display
   - Display "Planet Limit: X" in planet summary
   - Gray out locked items with "Requires: [Research Name]" tooltip

## Implementation Roadmap

### Phase 1: Core Types & Data (NEXT STEPS)
1. Add research data to game_data.json
2. Update types:
   - Add 'research' to LaneId type
   - Add research-specific types (ResearchEffect, ResearchItem)
   - Update ItemDefinition to include research

### Phase 2: State Management
1. Update PlayerState:
   - Add `researchPoints: number`
   - Add `planetLimit: number` (default: 4)
   - Add `completedResearch: string[]`
2. Update engine to handle research lane

### Phase 3: Production & Effects
1. Calculate RP production from scientists
2. Process research completion effects
3. Update validation for research prerequisites

### Phase 4: UI Updates
1. Add Research tab to TabbedLaneDisplay
2. Update resource display for RP
3. Add planet limit to dashboard
4. Update item graying logic

### Phase 5: Testing
1. Test RP production
2. Test research queueing and completion
3. Test prerequisite validation
4. Test planet limit increases
5. Test unit/structure unlocking

## Key Files to Modify

### Data Files
- [x] `src/lib/game/research_data.json` - Generated research data
- [ ] `src/lib/game/game_data.json` - Add research section

### Type Definitions
- [ ] `src/lib/sim/engine/types.ts` - Add research to LaneId
- [ ] `src/lib/game/types.ts` - Add research types

### Engine Files
- [ ] `src/lib/sim/engine/lanes.ts` - Handle research lane
- [ ] `src/lib/sim/engine/outputs.ts` - Calculate RP production
- [ ] `src/lib/sim/engine/completions.ts` - Apply research effects

### UI Components
- [ ] `src/components/QueueDisplay/TabbedLaneDisplay.tsx` - Add Research tab
- [ ] `src/components/PlanetDashboard.tsx` - Show planet limit
- [ ] `src/components/ResourceDisplay.tsx` - Show RP

### Tests
- [ ] `src/lib/game/__tests__/research.test.ts` - New test file

## Decisions Requiring User Input

1. **Research Queue Behavior**
   - Should research persist across timeline rewinds?
   - Can research be cancelled once started?
   - Should RP refund if research is cancelled?

2. **Multi-Planet Interaction (TICKET-8)**
   - Is research truly global or per-empire?
   - Do all planets contribute scientists to RP production?
   - Are completed researches shared instantly across planets?

3. **UI/UX Decisions**
   - Where to display planet limit most prominently?
   - How to show research progress (progress bar?)
   - Should locked items show research requirements in tooltip?

4. **Balance Decisions**
   - Should there be RP storage limits?
   - Can excess RP carry over or is it lost?
   - Should some research have additional costs (metal/mineral)?

## Current Blockers

1. **Type System Complexity**
   - Research doesn't fit cleanly into existing ItemDefinition structure
   - May need separate ResearchDefinition type
   - Lane system assumes all items use same resource types

2. **Timeline Interaction**
   - Research state needs special handling during timeline rewinds
   - Completed research should probably persist (like a global state)

3. **Testing Complexity**
   - Research system touches many parts of the codebase
   - Need comprehensive integration tests
   - Edge cases around prerequisites and unlocking

## Recommendation

Due to the complexity and the late hour, I recommend:

1. **Morning Review**: Review this document and the extracted research data
2. **Architectural Decision**: Decide if research should be:
   - A) A true 4th lane (current approach)
   - B) A separate system outside the lane architecture
   - C) A simplified version for MVP

3. **Incremental Implementation**:
   - Start with basic RP production and display
   - Add research queueing without effects
   - Implement effects and prerequisites
   - Polish UI and testing

The research data extraction is complete and ready to use. The next steps require architectural decisions that would benefit from your input.