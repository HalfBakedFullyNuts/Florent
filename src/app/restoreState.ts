import { saveEncodedStateToURL } from '../lib/game/urlState';

export type AutosaveTimer = ReturnType<typeof setTimeout>;
export interface RestoreIntent {
  encoded: string;
  shared: boolean;
  createdAt: number;
}

interface MutableRef<T> {
  current: T;
}

const RESTORE_INTENT_STORAGE_KEY = 'florent_restore_intent';
const RESTORE_INTENT_MAX_AGE_MS = 60_000;

export function clearAutosaveTimer(timerRef: MutableRef<AutosaveTimer | null>): void {
  if (timerRef.current === null) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function prepareRestoreForReload({
  encoded,
  shared = false,
  autosaveTimerRef,
  restoreInProgressRef,
  lastAppliedShareRef,
}: {
  encoded: string;
  shared?: boolean;
  autosaveTimerRef: MutableRef<AutosaveTimer | null>;
  restoreInProgressRef: MutableRef<boolean>;
  lastAppliedShareRef: MutableRef<string | null>;
}): void {
  restoreInProgressRef.current = true;
  clearAutosaveTimer(autosaveTimerRef);
  saveRestoreIntent({ encoded, shared, createdAt: Date.now() });
  saveEncodedStateToURL(encoded);
  lastAppliedShareRef.current = encoded;
}

export function consumeRestoreIntent(encoded: string | null): RestoreIntent | null {
  if (typeof window === 'undefined' || !encoded) return null;

  try {
    const raw = window.sessionStorage.getItem(RESTORE_INTENT_STORAGE_KEY);
    if (!raw) return null;

    window.sessionStorage.removeItem(RESTORE_INTENT_STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<RestoreIntent>;
    const isFresh = typeof parsed.createdAt === 'number' && Date.now() - parsed.createdAt < RESTORE_INTENT_MAX_AGE_MS;
    if (parsed.encoded !== encoded || !isFresh) return null;

    return {
      encoded,
      shared: parsed.shared === true,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function saveRestoreIntent(intent: RestoreIntent): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RESTORE_INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch { /* ignore */ }
}
