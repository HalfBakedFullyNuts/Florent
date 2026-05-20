# PERF-006: Show loading indicator during BL link decode

**Note**: This issue is bundled with PERF-002 — implement both together.

**Priority**: Medium (perceived performance)  
**Complexity**: S  
**Estimated impact**: Users no longer think the app is broken during load  
**Files**: `src/app/page.tsx`

## Problem

When opening a shared build list link, the app takes several seconds to decode and replay commands. The UI shows an empty or partially-rendered page with no feedback. Users report thinking the app is broken and refreshing — restarting the process.

**Root cause of the detection challenge**: `gameState` is never structurally empty — `createInitialGameState()` runs synchronously before the first render, producing a non-empty state. A `gameState.planets.size === 0` guard would never be true. The only reliable signal is an explicit "replay in progress" flag.

## Solution

Track replay phase with an explicit boolean state flag. Do not infer from state shape.

```tsx
const [isReplaying, setIsReplaying] = useState(false);

// In the initialization useEffect, before replayCommands:
if (encodedState) {
  setIsReplaying(true);
}

// After replayCommands completes and setGameState is called:
setIsReplaying(false);
```

Render the indicator conditionally (behind the existing `isMounted` guard to avoid SSR hydration mismatch):

```tsx
{isMounted && isReplaying && (
  <div className="fixed inset-0 flex items-center justify-center bg-pink-nebula-bg/80 z-50">
    <p className="text-pink-nebula-text animate-pulse text-lg font-mono">
      Loading build list...
    </p>
  </div>
)}
```

**No new dependencies.** `animate-pulse` is already available via Tailwind.

## Edge cases

- **Corrupted/undecodable URL**: `decodeGameState` returns null. The `setIsReplaying(false)` call must be in a `finally` block (or equivalent) so the indicator always clears, even if replay throws:
  ```tsx
  try {
    setIsReplaying(true);
    const decoded = decodeGameState(encodedState);
    if (decoded) replayCommands(decoded, gameState);
    setGameState(newState);
  } finally {
    setIsReplaying(false);
  }
  ```
- **No URL state**: `isReplaying` stays `false` — indicator never appears
- **LocalStorage load**: Also synchronous and fast — no indicator needed

## Acceptance criteria

- [ ] Opening a shared BL link shows "Loading build list..." within one paint frame
- [ ] Indicator is wrapped in `isMounted` guard — no hydration mismatch
- [ ] Indicator disappears once `setGameState` completes and `isReplaying` becomes false
- [ ] Corrupted URL: indicator appears then clears — no permanent spinner (finally block)
- [ ] No URL state: indicator never appears
- [ ] No layout shift when indicator is replaced by actual content
- [ ] No new npm dependencies added
