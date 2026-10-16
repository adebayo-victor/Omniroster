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
          (window as unknown as Record<string, unknown>).fetch = customFetch;
          patched = true;
        } catch (assignErr) {
          console.warn('[Loopback Guard] Could not overwrite window.fetch directly:', assignErr);
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
    // If registration fails (e.g. redirected script in iframe preview or dev proxy),
    // the Loopback Guard already handles /api/* seamlessly in-memory.
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
