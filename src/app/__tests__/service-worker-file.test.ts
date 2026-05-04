import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const sw = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');

describe('service worker file', () => {
  test('does not cache 404 responses as the app shell', () => {
    expect(sw).toContain("const CACHE_VERSION = 'v2'");
    expect(sw).toContain('if (fresh.ok)');
    expect(sw).toContain('if (fresh.status === 404)');
    expect(sw).toContain('getCachedShell()');
  });

  test('unregisters itself on local development hosts', () => {
    expect(sw).toContain("'localhost'");
    expect(sw).toContain('self.registration.unregister()');
    expect(sw).toContain("if (isLocalDevHost()) return;");
  });
});
