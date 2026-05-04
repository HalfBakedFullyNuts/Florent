export const serviceWorkerRegistrationScript = `
  if ('serviceWorker' in navigator) {
    const localDevHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
    const isLocalDevHost = localDevHosts.has(window.location.hostname);

    if (isLocalDevHost) {
      const registrations = navigator.serviceWorker.getRegistrations?.();
      registrations?.then((items) => {
        items.forEach((registration) => registration.unregister());
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
