# Open Issues - Turn-Based Simulator Implementation

## Critical Issues Requiring Resolution

### 1. Missing Structures in game_data.json
**Issue**: The following structures are mentioned as starting buildings but don't exist in game_data.json:
- `mineral_extractor` - Should produce mineral with abundance scaling
- `solar_generator` - Should produce energy

**Impact**: Cannot implement initial planet state without these structures.

**Proposed Solutions**:
1. Add the missing structures to game_data.json with appropriate stats
2. Modify initial planet state to exclude these structures
3. Use placeholder structures until data is available

**Recommended Action**: Add to game_data.json with stats similar to metal_mine:
```json
{
  "id": "mineral_extractor",
  "name": "Mineral Extractor",
  "tier": 1,
  "build_time_turns": 4,
  "cost": [
    { "type": "resource", "id": "metal", "amount": 2000 },
    { "type": "resource", "id": "mineral", "amount": 600 }
  ],
  "build_requirements": {
    "workers_occupied": 5000,
    "space_cost": [{ "type": "ground_space", "amount": 1 }]
  },
  "operations": {
    "production": [{ "type": "mineral", "base_amount": 300, "is_abundance_scaled": true }],
    "consumption": [{ "type": "resource", "id": "energy", "amount": 10 }]
  }
}

{
  "id": "solar_generator",
  "name": "Solar Generator",
  "tier": 1,
  "build_time_turns": 4,
  "cost": [
    { "type": "resource", "id": "metal", "amount": 3000 },
    { "type": "resource", "id": "mineral", "amount": 1500 }
  ],
  "build_requirements": {
    "workers_occupied": 2500,
    "space_cost": [{ "type": "ground_space", "amount": 1 }]
  },
  "operations": {
    "production": [{ "type": "energy", "base_amount": 100, "is_abundance_scaled": false }],
    "consumption": []
  }
}
```

### 2. Food Consumption Rate Discrepancy
**Issue**: game_data.json specifies `"amount_per_100_pop": 1` (1000 food per 100k workers), but user specified 0.002 per worker (200 food per 100k workers).

**Impact**: 5x difference in food consumption rates.

**Resolution**: Use user-specified rate (0.002 per worker) as override.

### 3. Worker-to-Colonist Conversion Clarity
**Issue**: The pseudocode mentions reserving multiple workers (n) and converting 1, but game_data.json shows cost as 1 worker consumed.

**Current Understanding**:
- Soldier/Scientist cost includes `{ "type": "unit", "id": "worker", "amount": 1, "is_consumed": true }`
- This means 1 worker is consumed to create 1 colonist
- No additional workers need to be reserved beyond construction workers

**Resolution**: Follow game_data.json - 1 worker consumed per colonist.

## Non-Critical Issues

### 4. Performance Targets
**Status**: Not defined yet
**Impact**: Cannot create performance benchmarks
**Note**: User indicated this is not critical for 300-turn simulation

### 5. Research System
**Status**: Research units (scientists) exist but no research structures or research point generation
**Impact**: Research lane may not be functional initially
**Resolution**: Can be added in future phase

## Implementation Notes

Before starting Phase 1 implementation:
1. **MUST RESOLVE**: Issues #1 (missing structures)
2. **DECIDED**: Issue #2 (use 0.002 food rate)
3. **CLARIFIED**: Issue #3 (1 worker per colonist)
4. **DEFER**: Issues #4-5 (not blocking)

---
Last Updated: 2025-10-25