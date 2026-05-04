import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { saveEncodedStateToURL } from '../../lib/game/urlState';
import { consumeRestoreIntent, prepareRestoreForReload, type AutosaveTimer } from '../restoreState';

describe('restore state handoff', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('cancels a pending autosave before restoring a selected save', () => {
    vi.useFakeTimers();

    const autosaveTimerRef = {
      current: setTimeout(() => saveEncodedStateToURL('old-auto-save'), 1000) as AutosaveTimer,
    };
    const restoreInProgressRef = { current: false };
    const lastAppliedShareRef = { current: null as string | null };

    prepareRestoreForReload({
      encoded: 'selected-save',
      autosaveTimerRef,
      restoreInProgressRef,
      lastAppliedShareRef,
    });

    vi.advanceTimersByTime(1000);

    expect(window.location.hash).toBe('#state=selected-save');
    expect(window.localStorage.getItem('florent_save')).toBe('selected-save');
    expect(autosaveTimerRef.current).toBeNull();
    expect(restoreInProgressRef.current).toBe(true);
    expect(lastAppliedShareRef.current).toBe('selected-save');
  });

  test('records and consumes whether the selected restore is shared', () => {
    const autosaveTimerRef = { current: null as AutosaveTimer | null };
    const restoreInProgressRef = { current: false };
    const lastAppliedShareRef = { current: null as string | null };

    prepareRestoreForReload({
      encoded: 'shared-save',
      shared: true,
      autosaveTimerRef,
      restoreInProgressRef,
      lastAppliedShareRef,
    });

    expect(consumeRestoreIntent('shared-save')).toMatchObject({
      encoded: 'shared-save',
      shared: true,
    });
    expect(consumeRestoreIntent('shared-save')).toBeNull();
  });
});
