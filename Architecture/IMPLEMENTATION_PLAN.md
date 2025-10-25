# Implementation Plan Summary

## Overview
This document summarizes the implementation strategy for transitioning from the current Infinite Conflict build planner to a full turn-based simulation engine.

## Current Status
- ✅ Architecture documentation reviewed
- ✅ Existing tickets analyzed and refined
- ✅ Migration strategy defined
- ✅ Architectural decisions documented
- 🚧 Ready to begin Phase 0 implementation

## Key Decisions Made

### 1. Migration Strategy
**Decision**: Parallel directory structure (`src/lib/sim/` alongside `src/lib/game/`)
**Rationale**: Allows gradual migration without breaking existing functionality

### 2. Data Transformation
**Decision**: Adapter pattern to transform existing `game_data.json`
**Rationale**: Preserves backward compatibility while enabling new engine format

### 3. Completion Timing
**Decision**: Two-path completion system
- Structures/Ships → Complete at start of next turn
- Colonists → Complete and convert in same turn
**Rationale**: Matches game design requirements for resource timing

### 4. Validation Strategy
**Decision**: Split validation between queue-time and activation-time
- Queue-time: Static constraints (prerequisites, energy forward-check)
- Activation-time: Dynamic constraints (resources, workers, space)
**Rationale**: Provides early feedback while handling dynamic resource availability

## Implementation Phases

### Phase 0: Preparation (1-2 days)
- Create parallel directory structure
- Document migration strategy
- Set up test fixtures framework
- Move existing code to legacy folder

### Phase 1: Core Engine (1 week)
**Tickets 1-8**: Build deterministic simulation engine
- Start with types and constants
- Implement validation and lanes
- Add completions and outputs
- Complete turn sequencing
- **Critical Path**: Must be framework-free and fully tested

### Phase 2: Integration Layer (3-4 days)
**Tickets 9-12**: Create orchestration between engine and UI
- Timeline management with snapshots
- Commands API for all mutations
- Selectors for read-only views
- Data adapter for existing content

### Phase 3: UI Migration (1 week)
**Tickets 13-19**: Update UI to use new engine
- Turn slider for time navigation
- Planet summary displays
- Lane boards with queue management
- Error and warning handling

### Phase 4: Testing & Performance (2-3 days)
**Tickets 20-22**: Comprehensive validation
- Unit tests with >90% coverage
- Integration tests for workflows
- Performance benchmarks

## Critical Implementation Details

### Data Format (from game_data.json)
**Key Mappings**:
- `build_requirements.workers_occupied` → Workers reserved during construction
- `build_requirements.space_cost` → Ground/orbital space required
- `operations.production` → Resources/units produced per turn
- `operations.consumption` → Energy consumed per turn
- `operations.effects` → Housing capacity and other permanent effects
- Units with `category: "colonist"` → Use colonist lane
- Units with `category: "ship"` → Use ship lane

**Initial Planet State**:
```typescript
{
  stocks: { metal: 30000, mineral: 20000, food: 1000, energy: 0 },
  abundance: { metal: 1.0, mineral: 1.0, food: 1.0, energy: 1.0 }, // 100%
  population: { workersTotal: 20000, workersIdle: 20000 },
  space: { groundUsed: 8, groundCap: 60, orbitalUsed: 0, orbitalCap: 40 },
  completedStructures: ['outpost', 'metal_mine' (x3), 'farm', 'solar_generator']
}
```

### Lane Execution Order
```
1. Start-of-turn completions (structures/ships from previous turn)
2. Building lane (activation & progression)
3. Ship lane (activation & progression)
4. Colonist lane (activation & progression)
5. Colonist conversions (same turn)
6. Resource production (with abundance scaling: 0-200%)
7. Worker growth (1% base + bonuses if food > 0)
8. Food upkeep (0.002 per worker = 200 per 100k workers, clamped at 0)
```

### Completion Buffer Implementation
```typescript
class CompletionBuffer {
  private completions: Map<number, WorkItem[]>;

  enqueue(turn: number, item: WorkItem): void;
  drain(turn: number): WorkItem[];
}
```

### Resource Clamping at Activation
```typescript
function clampBatchAtActivation(state, def, requested): number {
  // Check resources, workers, space, housing
  // Energy forward-check to ensure net >= 0
  // Return 0 to keep pending if insufficient
}
```

## Open Questions Resolved

### Q: How to handle existing game_data.json?
**A**: Create adapters in `src/lib/sim/defs/adapter.ts` to transform existing format to new ItemDefinition structure.

### Q: When do workers get released?
**A**:
- Structures/Ships: Released at start of next turn with completion
- Colonists: Released immediately during conversion
  - Soldier: 10 workers reserved → 9 return to idle, 1 becomes soldier
  - Scientist: 20 workers reserved → 19 return to idle, 1 becomes scientist

### Q: How to maintain determinism during migration?
**A**:
- Pure functions only in engine
- No side effects or external dependencies
- Clone state for modifications
- Fixed execution order

## Testing Strategy

### Unit Test Focus Areas
1. Validation functions (all edge cases)
2. Lane activation and clamping
3. Completion timing (same vs next turn)
4. Resource calculations with abundance
5. Growth and food mechanics

### Integration Test Scenarios
1. Full turn cycle with all lanes
2. Recomputation after timeline edit
3. Cancel/refund workflows
4. Resource contention between lanes

## Risk Mitigation

### Risk: Breaking existing functionality
**Mitigation**: Parallel directories, gradual migration, comprehensive testing

### Risk: Performance degradation
**Mitigation**: Benchmarks in Phase 4, optimize hot paths, consider memoization

### Risk: Complex state management
**Mitigation**: Immutable operations, clear separation of concerns, extensive testing

## Next Steps

1. **Immediate**: Start with Ticket 0 (Refactoring Strategy)
2. **Then**: Implement Tickets 1-2 (Types and Constants)
3. **Parallel**: Begin writing test fixtures
4. **Review**: After each phase, validate against requirements

## Success Criteria

- [ ] All existing functionality preserved during migration
- [ ] Deterministic simulation with reproducible results
- [ ] >90% test coverage on engine code
- [ ] Performance within acceptable thresholds
- [ ] Clean separation between engine and UI
- [ ] TDD process followed throughout

## Questions for Product Owner

Before proceeding with implementation:

1. **Abundance Values**: What are typical abundance ranges for resources?
2. **Initial State**: What should the default planet state include?
3. **Performance Target**: What's acceptable for 500-turn simulation?
4. **UI Priority**: Which UI components are most critical to migrate first?
5. **Data Migration**: Should we preserve save game compatibility?

---

This plan provides a clear path forward with minimal ambiguity. The phased approach ensures we maintain a working application throughout the migration while building a robust, testable simulation engine.