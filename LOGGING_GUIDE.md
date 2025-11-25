# Game Logging System

Comprehensive logging system for debugging and analyzing the turn-based simulation engine.

## Features

- **Queue Operations Logging**: Track all queue operations (queue, cancel, reorder, activate, complete)
- **State Snapshots**: Capture planet state at any turn (resources, population, lanes)
- **Timeline Events**: Monitor timeline mutations, recomputation, and stable states
- **CSV Export**: All logs are formatted as CSV for easy analysis in Excel/Google Sheets
- **Browser Storage**: Logs stored in localStorage for persistence across page reloads
- **Console API**: Full control via browser console commands

## Quick Start

### 1. Enable Logging

Open the browser console (F12) and run:

```javascript
gameLogger.enable()
```

### 2. Play the Game

Queue items, advance turns, and play normally. All operations are logged automatically.

### 3. Export Logs

Download all logs as CSV files:

```javascript
gameLogger.export()
```

This downloads 3 files:
- `session_[timestamp]_queue_operations.csv`
- `session_[timestamp]_planet_states.csv`
- `session_[timestamp]_timeline_events.csv`

### 4. Clear Logs

Remove all logs from localStorage:

```javascript
gameLogger.clear()
```

## Console Commands

### `gameLogger.enable()`
Enable logging. All subsequent game operations will be logged.

### `gameLogger.disable()`
Disable logging. No operations will be logged.

### `gameLogger.flush()`
Force flush pending logs to localStorage. Logs are automatically flushed every 50 operations.

### `gameLogger.export()`
Download all log files as CSV. Works even after disabling logging.

### `gameLogger.clear()`
Clear all logs from localStorage.

### `gameLogger.status()`
Show current logging status (enabled/disabled) and number of log files.

### `gameLogger.help()`
Show help message with all available commands.

## Log Files

### 1. Queue Operations (`queue_operations.csv`)

Tracks all queue-related operations:

**Columns:**
- `timestamp`: ISO timestamp when operation occurred
- `turn`: Game turn number
- `operation`: Operation type (queue, cancel, reorder, activate, complete)
- `laneId`: Lane identifier (building, ship, colonist, research)
- `itemId`: Item identifier (e.g., "farm", "fighter")
- `itemName`: Human-readable name
- `quantity`: Quantity involved (optional)
- `details`: Additional information about the operation

**Example:**
```csv
timestamp,turn,operation,laneId,itemId,itemName,quantity,details
2025-01-15T10:30:00.000Z,1,queue,building,farm,Farm,1,Queued at turn 1
2025-01-15T10:30:05.000Z,2,activate,building,farm,Farm,1,Activated with 1 quantity (requested: 1)
2025-01-15T10:30:20.000Z,6,complete,building,farm,Farm,1,Completed at turn 6
```

### 2. Planet States (`planet_states.csv`)

Snapshots of planet state at specific turns:

**Columns:**
- `timestamp`: ISO timestamp
- `turn`: Game turn number
- `metal`, `mineral`, `food`, `energy`, `research_points`: Resource stocks
- `workersTotal`, `workersIdle`, `soldiers`, `scientists`: Population counts
- `buildingActive`, `buildingPending`: Building lane status
- `shipActive`, `shipPending`: Ship lane status
- `colonistActive`, `colonistPending`: Colonist lane status
- `researchActive`, `researchPending`: Research lane status

**Example:**
```csv
timestamp,turn,metal,mineral,food,energy,research_points,workersTotal,workersIdle,soldiers,scientists,...
2025-01-15T10:30:00.000Z,1,30000,20000,1000,0,0,100000,95000,0,0,farm,0,,,0,,,0
```

### 3. Timeline Events (`timeline_events.csv`)

Timeline operations and state changes:

**Columns:**
- `timestamp`: ISO timestamp
- `turn`: Game turn number
- `event`: Event type (mutation, recompute, stable_state, advance)
- `description`: Human-readable description
- `affectedTurns`: Number of turns affected (optional)

**Example:**
```csv
timestamp,turn,event,description,affectedTurns
2025-01-15T10:30:00.000Z,1,mutation,State mutated at turn 1,199
2025-01-15T10:30:01.000Z,1,recompute,Recomputing 199 turns from turn 1,
2025-01-15T10:30:15.000Z,50,stable_state,Stable state detected at turn 50, fast-copying 149 turns,
2025-01-15T10:30:20.000Z,2,advance,Advanced to turn 2,
```

## Usage Examples

### Example 1: Debug a Specific Bug

```javascript
// 1. Enable logging
gameLogger.enable()

// 2. Reproduce the bug
// Queue items, advance turns, etc.

// 3. Export logs
gameLogger.export()

// 4. Open CSV in Excel/Google Sheets
// Analyze queue_operations.csv to see exact sequence of events
```

### Example 2: Performance Analysis

```javascript
// Enable logging
gameLogger.enable()

// Play for 50 turns
// ... play the game ...

// Export and analyze
gameLogger.export()

// Look at timeline_events.csv:
// - How many recomputes occurred?
// - When did stable state happen?
// - How many turns were fast-copied?
```

### Example 3: Resource Analysis

```javascript
// Enable logging
gameLogger.enable()

// Queue several farms
// Advance 20 turns

// Export logs
gameLogger.export()

// Analyze planet_states.csv:
// - Track food production over time
// - Monitor worker idle count
// - Check energy balance
```

### Example 4: Session Recording

```javascript
// Start a session
gameLogger.enable()

// Play entire game session
// ... play for an hour ...

// Export session logs
gameLogger.export()

// Clear when done
gameLogger.clear()
```

## Performance Impact

- **Minimal**: Logging adds ~1-2ms per operation
- **Storage**: Logs are flushed every 50 operations to minimize localStorage writes
- **Memory**: In-memory buffer holds max 50 operations before flush
- **Disabled by Default**: No performance impact when disabled

## Tips & Best Practices

### 1. Clear Logs Regularly
```javascript
// Clear before starting new session
gameLogger.clear()
gameLogger.enable()
```

### 2. Check Storage Size
```javascript
// See how many log files exist
gameLogger.status()
```

### 3. Flush Before Exporting
```javascript
// Ensure all logs are written
await gameLogger.flush()
gameLogger.export()
```

### 4. Analyze in Spreadsheet Software
- Open CSV files in Excel, Google Sheets, or LibreOffice Calc
- Use pivot tables to analyze patterns
- Filter by turn number, lane, or operation type
- Create charts to visualize resource changes over time

### 5. Grep for Specific Items
After exporting, use command-line tools:
```bash
# Find all operations for "farm"
grep "farm" session_*_queue_operations.csv

# Find all turns where energy was negative
grep "-[0-9]" session_*_planet_states.csv | grep "energy"

# Find all timeline mutations
grep "mutation" session_*_timeline_events.csv
```

## Troubleshooting

### Logs not appearing?
```javascript
// Check if logging is enabled
gameLogger.status()

// Enable if needed
gameLogger.enable()
```

### localStorage full?
```javascript
// Clear old logs
gameLogger.clear()
```

### Export not working?
```javascript
// Make sure logs are flushed
await gameLogger.flush()
gameLogger.export()
```

### Browser compatibility issues?
Logging uses:
- `localStorage` (supported in all modern browsers)
- `Blob` API (for file downloads)
- `URL.createObjectURL` (for downloads)

All are widely supported in modern browsers.

## Integration with Tests

The logging system can be used in test environments:

```typescript
import { initLogger, enableLogging, getLogger } from '../lib/game/logger';

describe('My Test', () => {
  beforeEach(() => {
    initLogger(true); // Enable for testing
  });

  afterEach(async () => {
    await getLogger().flush();
    // Logs available for inspection
  });

  it('should log queue operations', () => {
    // ... test code ...
    // Operations are automatically logged
  });
});
```

## Future Enhancements

Potential improvements for the logging system:

1. **Filtering**: Log only specific lanes or operation types
2. **Log Levels**: DEBUG, INFO, WARN, ERROR
3. **Remote Logging**: Send logs to server for production debugging
4. **Compression**: gzip logs before storing
5. **Time-based Auto-flush**: Flush every N seconds
6. **Search API**: Query logs directly from console
7. **Visualization**: Built-in charts and graphs in browser

## License

Part of the Infinite Conflict Turn-Based Simulator project.
