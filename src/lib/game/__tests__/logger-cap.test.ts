/**
 * Tests for logger localStorage cap: appending must not grow a session log
 * file without bound (5 MB quota would eventually break saves).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initLogger, getLogger, LOGGER_STORAGE_CAP_BYTES } from '../logger';

describe('logger appendToFile cap', () => {
  beforeEach(() => {
    window.localStorage.clear();
    initLogger(true);
    getLogger().clearLogsFromBrowser();
  });

  it('keeps stored log below the cap after many large appends', async () => {
    const logger = getLogger();
    const bigNote = 'x'.repeat(64 * 1024); // 64 KB of note text per op
    for (let i = 0; i < 12; i++) {
      logger.logQueueOperation(i, 'queue', 'building', 'farm', 'Farm', 1, bigNote);
      await logger.flush();
    }

    let maxKeyLen = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      maxKeyLen = Math.max(maxKeyLen, (window.localStorage.getItem(key) || '').length);
    }
    expect(maxKeyLen).toBeLessThanOrEqual(LOGGER_STORAGE_CAP_BYTES);
  });
});
