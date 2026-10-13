/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { handleLoopbackApi } from './src/utils/db';

declare let self: ServiceWorkerGlobalScope;

// Workbox precache injection point (must contain single match of self.__WB_MANIFEST)
const wbManifest = self.__WB_MANIFEST || [];
if (Array.isArray(wbManifest) && wbManifest.length > 0) {
  precacheAndRoute(wbManifest);
}
cleanupOutdatedCaches();

// Service Worker Lifecycle: install immediately without waiting
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Take immediate control of all open pages upon activation
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

// Loopback API Gateway: Intercept all /api/* requests
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        try {
          return await handleLoopbackApi(event.request);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown gateway error';
          return new Response(JSON.stringify({ error: 'Service Worker Gateway Error: ' + msg }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })()
    );
  }
});

// Support manual skipWaiting message from registration scripts
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
