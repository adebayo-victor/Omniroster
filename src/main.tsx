import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { handleLoopbackApi } from './utils/db.ts';

// ============================================================================
// 1. Dual-Layer Loopback Fetch Guard
// ============================================================================
// In dev environments (like GitHub Codespaces) or on initial page load before the
// Service Worker finishes claiming clients, standard fetch('/api/...') can leak
// to the Vite dev server and result in 404. This interceptor catches any /api/*
// request if the Service Worker controller is not yet actively intercepting it.
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const urlString =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const isApiRequest =
        urlString.startsWith('/api/') ||
        urlString.startsWith(`${window.location.origin}/api/`);

      // If the Service Worker is actively controlling the page, let the SW fetch handler intercept it.
      // If the Service Worker is NOT yet controlling the page, handle directly via loopback logic.
      if (isApiRequest && (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller)) {
        const fullUrl = urlString.startsWith('http')
          ? urlString
          : `${window.location.origin}${urlString}`;
        const syntheticRequest = new Request(fullUrl, init);
        return await handleLoopbackApi(syntheticRequest);
      }
    } catch (err: unknown) {
      console.warn('[Loopback Guard] Direct fallback active:', err);
    }

    return originalFetch(input, init);
  };
}

// ============================================================================
// 2. Service Worker Dev & Prod Registration Gateway
// ============================================================================
// In Vite development mode with `vite-plugin-pwa` (injectManifest), the SW is
// compiled on-the-fly and served at `/dev-sw.js?dev-sw` with type: 'module'.
// In production builds, it is compiled to `/sw.js`.
async function initServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers are not supported in this browser environment.');
    return;
  }

  try {
    const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
    const swType: WorkerType = import.meta.env.DEV ? 'module' : 'classic';

    const registration = await navigator.serviceWorker.register(swUrl, {
      type: swType,
      scope: '/',
    });

    console.log('[PWA] Service Worker registered successfully at:', swUrl);

    // If a service worker is updating/installing, tell it to take over
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Wait briefly for controller takeover if not already controlling
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 800);
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
      });
    }
  } catch (err) {
    console.warn('[PWA] Service Worker registration note:', err);
  }
}

// ============================================================================
// 3. Application Bootstrap
// ============================================================================
async function bootstrap() {
  // Ensure the Service Worker is registered before initial React queries fire
  await initServiceWorker();

  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(<App />);
  }
}

bootstrap();
