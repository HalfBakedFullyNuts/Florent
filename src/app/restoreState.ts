import { saveEncodedStateToURL } from '../lib/game/urlState';

export type AutosaveTimer = ReturnType<typeof setTimeout>;

interface MutableRef<T> {
  current: T;
}

export function clearAutosaveTimer(timerRef: MutableRef<AutosaveTimer | null>): void {
  if (timerRef.current === null) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function prepareRestoreForReload({
  encoded,
  autosaveTimerRef,
  restoreInProgressRef,
  lastAppliedShareRef,
}: {
  encoded: string;
  autosaveTimerRef: MutableRef<AutosaveTimer | null>;
  restoreInProgressRef: MutableRef<boolean>;
  lastAppliedShareRef: MutableRef<string | null>;
}): void {
  restoreInProgressRef.current = true;
  clearAutosaveTimer(autosaveTimerRef);
  saveEncodedStateToURL(encoded);
  lastAppliedShareRef.current = encoded;
}
