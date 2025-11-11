# Research System Implementation Progress

## ✅ Completed Tasks

### Core System Implementation
1. **Research as 4th Lane** - Research is now a fully integrated 4th lane in the queue system
   - Added 'research' to LaneId type
   - Research lane has maxQueueDepth of 1 (only one research at a time)
   - Research items consume RP instead of regular resources
   - No worker reservation required for research

2. **Research Points (RP) Resource**
   - Added 'research_points' to ResourceId type
   - Integrated into stocks, abundance, and NetOutputs
   - Scientists produce 1 RP per scientist per turn
   - RP displayed in resource dashboard with purple color

3. **Planet Limit System**
   - Added planetLimit field to PlanetState (default: 4)
   - Planet limit displayed in "Space Remaining" section with purple progress bar
   - Research can increase planet limit through effects

4. **Research Data Integration**
   - Successfully extracted 36 research items from CSV
   - Converted and added to game_data.json
   - Research categories:
     - 3 basic research items
     - 11 planet limit increases (PL 6-24)
     - 12 unit/structure unlocks
     - 10 technology improvements

5. **Validation & Prerequisites**
   - Updated hasPrereqs to check completedResearch array
   - Research completion adds to completedResearch list
   - Prerequisites properly validated before queueing

6. **UI Integration**
   - Added Research tab to TabbedLaneDisplay (4th tab with 🔬 icon)
   - Research Points shown in resource display
   - Planet limit counter in Space Remaining section
   - Research lane properly passed to UI components

## 🚧 Remaining Tasks

### Gray Out Locked Items (In Progress)
- Need to implement visual indication for locked items
- Add tooltips showing required research/structures
- This will be in the item selection UI

### Testing
- Write comprehensive tests for:
  - RP production from scientists
  - Research queueing and completion
  - Prerequisite validation
  - Planet limit increases
  - Research unlocking mechanics

## Technical Details

### Files Modified
- `src/lib/sim/engine/types.ts` - Added research types and fields
- `src/lib/sim/defs/seed.ts` - Initialize research lane and planetLimit
- `src/lib/sim/engine/outputs.ts` - RP production from scientists
- `src/lib/sim/rules/constants.ts` - Added research to resource/lane arrays
- `src/lib/sim/engine/validation.ts` - Research prerequisite checking
- `src/lib/sim/engine/completions.ts` - Research completion effects
- `src/components/QueueDisplay/TabbedLaneDisplay.tsx` - Research UI tab
- `src/components/PlanetDashboard.tsx` - Planet limit and RP display
- `src/lib/game/selectors.ts` - Added planetLimit to PlanetSummary
- `src/lib/game/game_data.json` - Added 36 research items

### Files Created
- `src/lib/game/research_data.json` - Research data extracted from CSV
- `scripts/extract-research-data.js` - CSV extraction script
- `scripts/add-research-to-game-data.js` - Data integration script

## User Decisions Implemented

1. **Planet Limit Display**: Added as new counter in "Space Remaining" section
2. **Research Lane Behavior**: Research items handled like buildings/units but consume RP instead of resources and require no workers
3. **Locked Items**: Will be grayed out with tooltips (implementation pending)

## Next Steps

1. Complete gray out functionality for locked items
2. Write comprehensive test suite
3. Test full research flow end-to-end
4. Implement TICKET-8 (Multiple Planet Support)

---

*Implementation based on user requirements from overnight session*
*Research system follows existing lane architecture for consistency*