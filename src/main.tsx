import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { handleLoopbackApi } from './utils/db.ts';

// ============================================================================
// 1. Dual-Layer Loopback Fetch Guard
// ============================================================================
// In dev environments (like GitHub Codespaces or Cloud Run previews) or on initial
// page load before the Service Worker finishes claiming clients, standard
// fetch('/api/...') can leak to the Vite dev server and result in 404.
// This interceptor safely catches any /api/* request when the Service Worker is
// not yet actively controlling the page.
function installFetchInterceptor(): void {
  if (typeof window === 'undefined') return;

  try {
    const originalFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (!originalFetch) return;

    const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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

        // Intercept all /api/ requests directly in client-side fetch.
        // This guarantees that even if the browser holds onto an older cached Service Worker,
        // all database operations and endpoints succeed reliably and immediately without 404s.
        if (isApiRequest) {
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

    // Safely assign customFetch via Object.defineProperty to prevent:
    // "TypeError: Cannot set property fetch of #<Window> which has only a getter"
    let patched = false;
    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true,
      });
      patched = true;
    } catch {
      // Fallback to Window.prototype if window is non-configurable
      try {
        Object.defineProperty(Window.prototype, 'fetch', {
          value: customFetch,
          writable: true,
          configurable: true,
        });
        patched = true;
      } catch {
        try {
          Object.defineProperty(window, 'fetch', {
            get: () => customFetch,
            configurable: true,
          });
          patched = true;
        } catch (assignErr) {
          console.warn('[Loopback Guard] Could not patch window.fetch:', assignErr);
        }
      }
    }

    if (patched) {
      console.log('[Loopback Guard] Fetch interceptor installed successfully.');
    }
  } catch (err) {
    console.warn('[Loopback Guard] Initialization error:', err);
  }
}

// Install interceptor immediately before any React component effects run
installFetchInterceptor();

// ============================================================================
// 2. Service Worker Production Registration Gateway
// ============================================================================
// In development mode, the Loopback Guard directly routes all /api/* requests
// to IndexedDB, preventing issues with dev server proxy redirects.
// In production builds, the Service Worker (/sw.js) is registered to provide
// 100% offline-first PWA caching and background sync.
async function initServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers are not supported in this browser environment.');
    return;
  }

  // In development environments (including sandboxes and Codespaces),
  // rely directly on the client-side Loopback Guard for zero-latency IndexedDB routing.
  if (import.meta.env.DEV) {
    console.log('[PWA] Development mode active: Loopback Guard is handling all /api/* requests.');
    return;
  }

  try {
    const swUrl = '/sw.js';
    const registration = await navigator.serviceWorker.register(swUrl, {
      type: 'classic',
      scope: '/',
    });

    console.log('[PWA] Service Worker registered successfully at:', swUrl);

    // Force an immediate update check to ensure browser drops outdated SW cache
    try {
      await registration.update();
    } catch {
      // ignore offline update error
    }

    // If a service worker is updating/installing, tell it to take over
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Wait briefly for controller takeover if not already controlling
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 600);
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
    console.warn('[PWA] Service Worker registration note (Loopback Guard active):', err);
  }
}

// ============================================================================
// 3. Application Bootstrap
// ============================================================================
async function bootstrap() {
  try {
    // Attempt Service Worker registration without blocking UI mount if it takes time
    await initServiceWorker();
  } catch (e) {
    console.warn('[Bootstrap] SW init note:', e);
  }

  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(<App />);
  }
}

bootstrap();
