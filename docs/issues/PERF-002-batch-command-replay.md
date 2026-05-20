# PERF-002: Batch command replay + loading indicator for BL link loading

**Priority**: Critical  
**Complexity**: S (given PERF-001)  
**Estimated impact**: 5-10x faster shared link loading (50 commands → 1 recompute instead of 50)  
**Depends on**: PERF-001  
**Files**: `src/lib/game/urlState.ts`, `src/app/page.tsx`

## Problem

When a user opens a shared build list link, `replayCommands()` (urlState.ts ~line 1394) iterates through all decoded commands and calls `queueItem`/`queueWaitItem`/`cancelPlannedItem` one at a time. Each command triggers `mutateAtTurn` → `recomputeAll`, which re-simulates 50+ turns.

A typical shared BL contains 50-200 commands = 50-200 full timeline recomputes during loading, taking up to 10 seconds. Users report thinking the app is broken.

Compounding this: there is no visual feedback during the decode phase, so users refresh and restart the process.

## Solution part 1: batch the replay

Wrap the command loop for each planet in `timeline.withBatch()` (from PERF-001). All commands replay against the immediately-mutated (but not yet re-simulated) state. One recompute fires at the end.

```ts
// In replayCommands, for each planet's command sequence:
planet.timeline.withBatch(() => {
  for (const cmd of planetCommands) {
    // existing dispatch: queueItem / queueWaitItem / cancelPlannedItem / etc.
  }
});
```

**Prerequisite check**: Plain `queueItem` and `queueWaitItem` calls push to `pendingQueue` and call `tryActivateNext` synchronously on the in-memory state — they do not call `getStateAtTurn`. This means the PERF-001 "no reads inside batch" contract is not violated here. If any command type does call `getStateAtTurn` (e.g. reorder, cancel), it must be handled outside the batch or after the initial bulk queue is established.

**Research gate commands**: `refreshLocalResearchGates` is called inline for research cancel commands. Verify it doesn't trigger timeline reads; if it does, move it after the batch closes.

**Future-proofing**: Document that any new command type added to `replayCommands` that calls `getStateAtTurn` must not be placed inside the batch scope.

## Solution part 2: loading indicator

Currently `replayCommands` runs synchronously inside a `useEffect` — the React component mounts with the default empty state, the effect fires, replay completes, and `setGameState` is called all before the browser can paint. The loading window is invisible to the user as a React state, making a `gameState.planets.size === 0` guard unreliable.

**Implementation**: Track replay phase with an explicit ref:

```tsx
const isReplayingRef = useRef(false);
const [isReplaying, setIsReplaying] = useState(false);

// In the initialization useEffect, before replayCommands:
if (encodedState) {
  setIsReplaying(true);
  isReplayingRef.current = true;
}

// After replayCommands + setGameState:
setIsReplaying(false);
isReplayingRef.current = false;
```

Render the indicator conditionally:

```tsx
{isReplaying && (
  <div className="fixed inset-0 flex items-center justify-center bg-pink-nebula-bg/80 z-50">
    <p className="text-pink-nebula-text animate-pulse text-lg font-mono">
      Loading build list...
    </p>
  </div>
)}
```

Guard behind `isMounted` (already exists in page.tsx) to avoid SSR hydration mismatch. No new dependencies.

## Acceptance criteria

- [ ] `replayCommands` triggers exactly 1 `recomputeAll` per planet regardless of command count (verify via spy)
- [ ] Decoded game state after batched replay is **identical** to non-batched replay for a known 30-command snapshot (snapshot comparison test)
- [ ] Loading the test URL (`q4.BA4J...`) completes in <3 seconds (was ~10s)
- [ ] "Loading build list..." indicator appears within one paint frame of the page loading when a BL URL is present
- [ ] Indicator disappears once `setGameState` completes
- [ ] No layout shift when indicator is replaced by actual content
- [ ] Page loads correctly with no URL state (indicator never appears)
- [ ] Page loads correctly with a corrupted/undecodable URL (indicator appears then app falls back gracefully — no permanent spinner)
- [ ] All existing tests pass
