/**
 * Florent service worker.
 *
 * Strategy:
 *   - HTML navigation requests: network-first, fall back to the cached app shell
 *     (so updates appear immediately when online; the shell is available offline).
 *   - Same-origin static assets (Next.js _next/, /icons/, /vendor/, css, js, fonts):
 *     cache-first with a stale-while-revalidate top-up.
 *   - Cross-origin and other requests: pass through to the network unchanged.
 *
 * Bump CACHE_VERSION whenever this file changes so old SWs evict their caches.
 */

const CACHE_VERSION = 'v2';
const RUNTIME_CACHE = `florent-runtime-${CACHE_VERSION}`;
const SHELL_CACHE = `florent-shell-${CACHE_VERSION}`;
const SHELL_URLS = ['./', './index.html', './manifest.json'];
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function isLocalDevHost() {
  return LOCAL_DEV_HOSTS.has(self.location.hostname);
}

self.addEventListener('install', (event) => {
  if (isLocalDevHost()) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  if (isLocalDevHost()) {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('florent-')).map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url)))),
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('florent-') && k !== RUNTIME_CACHE && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/vendor/') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  if (isLocalDevHost()) return;

  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin: don't intervene.
  if (url.origin !== self.location.origin) return;

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstHTML(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('./', fresh.clone()).catch(() => {});
      return fresh;
    }
    if (fresh.status === 404) {
      const cached = await getCachedShell();
      if (cached) return cached;
    }
    return fresh;
  } catch {
    const cached = await getCachedShell();
    if (cached) return cached;
    return new Response('Offline and no cached copy available.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function getCachedShell() {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match('./')) || (await cache.match('./index.html'));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response('', { status: 504 });
}
