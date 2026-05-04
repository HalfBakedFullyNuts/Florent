import { describe, expect, test } from 'vitest';
import { serviceWorkerRegistrationScript } from '../serviceWorkerRegistration';

describe('service worker registration script', () => {
  test('excludes local development hosts from registration', () => {
    expect(serviceWorkerRegistrationScript).toContain("'localhost'");
    expect(serviceWorkerRegistrationScript).toContain("'127.0.0.1'");
    expect(serviceWorkerRegistrationScript).toContain("'::1'");
    expect(serviceWorkerRegistrationScript).toContain("isLocalDevHost");
    expect(serviceWorkerRegistrationScript).toContain("register('./sw.js')");
  });
});
