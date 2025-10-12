# API Documentation - Florent Simulator

## Core Game Logic API

### `src/lib/game/agent.ts`

The agent module handles all game mechanics, build queue operations, and resource management.

#### Functions

##### `enqueueItem(player: PlayerState, itemId: string, itemType: 'structure' | 'unit', count: number)`
Queues an item for construction after validating prerequisites and resources.

**Parameters:**
- `player`: Current game state
- `itemId`: Canonical ID of the item to build
- `itemType`: Whether building a structure or unit
- `count`: Number of items to queue

**Returns:** `{ ok: boolean, reason?: string }`

**Example:**
```typescript
const result = enqueueItem(player, 'metal_mine', 'structure', 1);
if (!result.ok) {
  console.error(result.reason); // "Insufficient resources"
}
```

---

##### `processTick(player: PlayerState, abundances: PlanetAbundances, delta: number)`
Advances game simulation by processing resource production, consumption, and build progress.

**Parameters:**
- `player`: Current game state (mutated in place)
- `abundances`: Planet resource multipliers
- `delta`: Number of ticks to process

**Effects:**
- Updates resources based on production/consumption
- Decrements build timers
- Completes finished items
- Applies stalling if energy negative

---

##### `validateRequirements(player: PlayerState, requirements: Requirement[])`
Checks if player meets all prerequisites for construction.

**Parameters:**
- `player`: Current game state
- `requirements`: Array of structure/research requirements

**Returns:** `{ ok: boolean, reason?: string }`

---

##### `cancelQueueItemImpl(player: PlayerState, itemId: string)`
Cancels a queued item and refunds its costs.

**Parameters:**
- `player`: Current game state
- `itemId`: UUID of the queue item

**Returns:** `{ ok: boolean, reason?: string }`

---

### `src/lib/game/dataManager.ts`

Provides typed access to game configuration data with validation.

#### Class: `GameDataService`

##### `getAllUnits(): Unit[]`
Returns all available units in the game.

##### `getAllStructures(): Structure[]`
Returns all available structures.

##### `getUnitById(id: string): Unit | null`
Fetches a specific unit definition by its canonical ID.

##### `getStructureById(id: string): Structure | null`
Fetches a specific structure definition.

##### `getResourceById(id: string): Resource | null`
Returns resource metadata.

**Example:**
```typescript
import GameData from './dataManager';

const metalMine = GameData.getStructureById('metal_mine');
console.log(metalMine.cost); // [{ type: 'resource', id: 'metal', amount: 1000 }]
```

---

## React Components API

### `src/app/page.tsx`

#### Main Component: `Home()`

The primary simulator interface managing game state and UI.

##### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `basePlayer` | `PlayerState` | Core game state at base time |
| `currentTurn` | `number` | Currently viewed turn (0-200) |
| `activeTab` | `TabType` | Selected building category |
| `lastError` | `string \| null` | Latest error message |

##### Key Functions

###### `initializePlayer(): PlayerState`
Creates starting game state with initial resources and buildings.

###### `calculateIncome(player, abundances): ResourcePool`
Computes net resource income/consumption per turn.

###### `simulateToTurn(basePlayer, targetTurn, abundances): PlayerState`
Simulates game state to a specific turn.

###### `queueItem(itemId, itemType): void`
User action to queue an item and auto-advance time.

###### `resetSimulation(): void`
Resets to initial game state.

---

### Helper Component: `ClientOnly`

Wrapper preventing SSR hydration mismatches for formatted numbers.

**Props:**
- `children`: React.ReactNode

**Usage:**
```tsx
<ClientOnly>
  <span>{numberValue.toLocaleString('en-US')}</span>
</ClientOnly>
```

---

## Type Definitions

### `src/lib/game/types.ts`

#### Core Types

##### `PlayerState`
```typescript
interface PlayerState {
  resources: ResourcePool;
  income: ResourcePool;
  ownedBuildings: OwnedBuilding[];
  completedResearch: string[];
  buildQueue: QueueItem[];
  unitCounts: Record<string, number>;
  tick: number;
  meta?: Record<string, unknown>;
}
```

##### `ResourcePool`
```typescript
interface ResourcePool {
  mass: number;      // Metal resources
  mineral: number;   // Mineral resources
  food: number;      // Food resources
  energy: number;    // Energy resources
}
```

##### `QueueItem`
```typescript
interface QueueItem {
  id: string;                // UUID
  name: string;              // Item canonical ID
  type: 'Building' | 'Unit' | 'Research';
  remainingTime: number;     // Ticks until completion
  massReserved: number;      // Reserved resources
  energyReserved: number;
  meta?: Record<string, unknown>;
}
```

##### `Structure`
```typescript
interface Structure {
  id: string;
  name: string;
  build_time_turns?: number;
  cost?: Cost[];
  requirements?: Requirement[];
  operations?: {
    production?: Production[];
    consumption?: Consumption[];
    effects?: Effect[];
  };
  max_per_planet?: number;
}
```

##### `Unit`
```typescript
interface Unit {
  id: string;
  name: string;
  category?: string;         // 'colonist' | 'ship'
  build_time_turns?: number;
  cost?: Cost[];
  consumption?: Consumption[];
  requirements?: Requirement[];
}
```

---

## Game Configuration

### `src/lib/game/game_data.json`

Contains all game configuration including:

- **Resources**: Metal, Mineral, Food, Energy definitions
- **Structures**: All buildings with costs, requirements, production
- **Units**: Ships and colonists with prerequisites
- **Effects**: Special building effects (housing, unlocks)

### Structure Example:
```json
{
  "id": "metal_mine",
  "name": "Metal Mine",
  "build_time_turns": 5,
  "cost": [
    { "type": "resource", "id": "metal", "amount": 1000 }
  ],
  "operations": {
    "production": [
      { "type": "metal", "base_amount": 400, "is_abundance_scaled": true }
    ]
  }
}
```

---

## Testing API

### Test Utilities

Located in `src/app/__tests__/` and `src/lib/game/__tests__/`

#### Key Test Functions

##### Agent Tests (`agent.test.ts`)
- `validatePrereqs()` - Tests prerequisite validation
- `enqueueItem()` - Tests queue operations
- `processTick()` - Tests game simulation

##### Integration Tests (`integration.test.ts`)
- Multi-tick simulations
- Resource accumulation validation
- Build completion verification

---

## Usage Examples

### Basic Build Queue Operation
```typescript
// Initialize game
const player = initializePlayer();
const abundances = { metal: 1, mineral: 1, food: 1 };

// Queue a metal mine
const result = enqueueItem(player, 'metal_mine', 'structure', 1);

// Simulate 5 turns
for (let i = 0; i < 5; i++) {
  processTick(player, abundances, 1);
}

// Check completion
console.log(player.ownedBuildings); // Includes new metal mine
```

### Resource Calculation
```typescript
const income = calculateIncome(player, abundances);
console.log(`Metal per turn: ${income.mass}`);
console.log(`Food consumption: ${income.food}`);
```

### Time Travel Simulation
```typescript
// View game state at turn 50
const futureState = simulateToTurn(player, 50, abundances);
console.log(`Resources at turn 50:`, futureState.resources);
```

---

## Error Handling

All API functions return consistent error objects:

```typescript
interface AgentResult {
  ok: boolean;
  reason?: string;  // Present when ok === false
}
```

Common error reasons:
- `"Insufficient resources"` - Not enough resources to build
- `"Missing structure {id}"` - Prerequisite building not built
- `"Item not found"` - Invalid item ID provided
- `"Factory not owned"` - Attempting to build without required facility

---

## Performance Considerations

- `simulateToTurn()` creates deep clone - O(n) for state size
- `processTick()` mutates state in-place - O(buildings + queue)
- Validation functions are lightweight - O(requirements)
- Resource calculations scale with building count

## Future API Extensions

Planned additions for future versions:
- Research system implementation
- Multi-planet support
- Combat simulation
- Technology tree navigation
- Save/load functionality
- Build order export/import