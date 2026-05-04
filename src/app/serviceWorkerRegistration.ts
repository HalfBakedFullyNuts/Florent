export const serviceWorkerRegistrationScript = `
  if ('serviceWorker' in navigator) {
    const localDevHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
    const isLocalDevHost = localDevHosts.has(window.location.hostname);
    const localCleanupReloadKey = 'florent-sw-local-cleanup-reloaded';

    if (isLocalDevHost) {
      const registrations = navigator.serviceWorker.getRegistrations?.();
      registrations?.then((items) => {
        return Promise.all(items.map((registration) => registration.unregister())).then(() => items.length);
      }).then((removedCount) => {
        if (
          removedCount > 0 &&
          navigator.serviceWorker.controller &&
          window.sessionStorage?.getItem(localCleanupReloadKey) !== '1'
        ) {
          window.sessionStorage.setItem(localCleanupReloadKey, '1');
          window.location.reload();
        }
      }).catch((err) => {
        console.warn('[SW] local dev cleanup failed:', err);
      });
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('[SW] registration failed:', err);
        });
      });
    }
  }
`;
