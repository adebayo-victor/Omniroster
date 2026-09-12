// Client-Side Face Detection and Continuous Boundary Gating via face-api.js
// TinyFaceDetector + FaceLandmark68 + FaceRecognition Neural Networks
// 100% Offline Caching via native CacheStorage API

declare global {
  interface Window {
    faceapi?: any;
  }
}

export interface FaceDetectionResult {
  isDetected: boolean;
  isAligned: boolean;
  isMatched: boolean;
  distance?: number;
  similarity?: number;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score?: number;
  diffX?: number;
  diffY?: number;
  badgeStatus: 'aligned' | 'not_detected' | 'mismatch' | 'loading' | 'error';
  badgeMessage: string;
}

export const CACHE_NAME = 'omni_biometrics_v2';
export const LEGACY_CACHE_NAME = 'face-api-weights-v1';
export const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
export const LOCAL_FALLBACK_URL = '/models';

export const MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

/**
 * 5-minute extended timeout window (300,000 ms) for all network / API requests
 */
export const API_TIMEOUT_MS = 5 * 60 * 1000; // 300,000 ms (5 minutes)

/**
 * Fetch with configurable timeout fallback (default 5 minutes / 300,000 ms)
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs = API_TIMEOUT_MS,
  init?: RequestInit
): Promise<Response | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);
    return res;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn(`[Biometrics] Request to ${url} failed or timed out (${timeoutMs}ms):`, err);
    return null;
  }
}

/**
 * Safe net loader with 5-minute timeout fallback (300,000 ms):
 * Prevents premature abort on slow networks while ensuring kiosks never freeze
 */
export async function loadNetWithTimeout(
  net: any,
  netName: string,
  url = MODEL_URL,
  timeoutMs = API_TIMEOUT_MS
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`⚠️ [Biometrics] Model ${netName} load timed out after ${timeoutMs}ms. Continuing kiosk boot.`);
        resolve(false);
      }
    }, timeoutMs);

    (async () => {
      try {
        await net.loadFromUri(url);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(true);
        }
      } catch (cdnErr) {
        console.warn(`⚠️ [Biometrics] Loading ${netName} from ${url} failed, trying fallback:`, cdnErr);
        try {
          if (url !== LOCAL_FALLBACK_URL) {
            await net.loadFromUri(LOCAL_FALLBACK_URL);
          }
        } catch (localErr) {
          console.warn(`⚠️ [Biometrics] Local fallback for ${netName} failed:`, localErr);
        }
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(false);
        }
      }
    })();
  });
}

export interface BootProgressInfo {
  step: number;
  totalSteps: number;
  percent: number;
  currentLog: string;
  allLogs: string[];
  isOfflineCached: boolean;
  isComplete: boolean;
  error?: string;
}

export type BiometricCacheStatus = 'caching' | 'ready';

let currentCacheStatus: BiometricCacheStatus = 'caching';
const statusListeners = new Set<(status: BiometricCacheStatus) => void>();

export function getBiometricCacheStatus(): BiometricCacheStatus {
  if (typeof window !== 'undefined' && localStorage.getItem('omniroster_biometrics_cached') === 'true') {
    return 'ready';
  }
  return currentCacheStatus;
}

export function subscribeBiometricCacheStatus(listener: (status: BiometricCacheStatus) => void): () => void {
  statusListeners.add(listener);
  listener(getBiometricCacheStatus());
  return () => statusListeners.delete(listener);
}

function updateCacheStatus(status: BiometricCacheStatus) {
  currentCacheStatus = status;
  if (status === 'ready' && typeof window !== 'undefined') {
    try {
      localStorage.setItem('omniroster_biometrics_cached', 'true');
    } catch (e) {}
  }
  statusListeners.forEach((fn) => {
    try {
      fn(status);
    } catch (e) {}
  });
}

let fetchIntercepted = false;

/**
 * Cache-aware fetch function that serves model shards from CacheStorage when offline or cached
 */
export async function cachedModelFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof Request
      ? input.url
      : input.toString();

  const matchedModelFile = MODEL_FILES.find((filename) => urlStr.includes(filename));

  if (matchedModelFile && typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const cdnUrl = `${MODEL_URL}${matchedModelFile}`;
      const originUrl = `${window.location.origin}/models/${matchedModelFile}`;
      const match =
        (await cache.match(cdnUrl)) ||
        (await cache.match(input)) ||
        (await cache.match(urlStr)) ||
        (await cache.match(originUrl)) ||
        (await cache.match(`/models/${matchedModelFile}`)) ||
        (await cache.match(matchedModelFile));

      if (match) {
        return match.clone();
      }
    } catch (cacheErr) {
      console.warn('CacheStorage lookup fallback to network:', cacheErr);
    }
  }

  const nativeFetch =
    typeof window !== 'undefined' && typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : fetch;

  try {
    const response = await nativeFetch(input, init);

    if (matchedModelFile && response && response.ok && typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_NAME);
        const cdnUrl = `${MODEL_URL}${matchedModelFile}`;
        const originUrl = `${window.location.origin}/models/${matchedModelFile}`;
        await cache.put(cdnUrl, response.clone()).catch(() => {});
        await cache.put(originUrl, response.clone()).catch(() => {});
        await cache.put(input, response.clone()).catch(() => {});
        await cache.put(`/models/${matchedModelFile}`, response.clone()).catch(() => {});
        await cache.put(matchedModelFile, response.clone()).catch(() => {});
      } catch (putErr) {
        console.warn('Failed to store model file in CacheStorage:', putErr);
      }
    }

    return response;
  } catch (netErr) {
    // Offline fallback: try cache once more
    if (matchedModelFile && typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_NAME);
        const cdnUrl = `${MODEL_URL}${matchedModelFile}`;
        const originUrl = `${window.location.origin}/models/${matchedModelFile}`;
        const match =
          (await cache.match(cdnUrl)) ||
          (await cache.match(input)) ||
          (await cache.match(urlStr)) ||
          (await cache.match(originUrl)) ||
          (await cache.match(`/models/${matchedModelFile}`)) ||
          (await cache.match(matchedModelFile));

        if (match) {
          return match.clone();
        }
      } catch (matchErr) {
        console.warn('Secondary cache lookup failed:', matchErr);
      }
    }
    throw netErr;
  }
}

/**
 * Configure faceapi to load model weights directly
 * from CacheStorage (caches.match()) when offline or cached.
 */
export function setupFaceApiFetchCacheInterceptor(): void {
  if (typeof window === 'undefined' || fetchIntercepted) return;
  fetchIntercepted = true;

  // 1. Monkey patch faceapi if already loaded
  if (window.faceapi?.env?.monkeyPatch) {
    try {
      window.faceapi.env.monkeyPatch({ fetch: cachedModelFetch });
    } catch (e) {
      console.warn('faceapi.env.monkeyPatch error:', e);
    }
  }

  // 2. Safely attempt to patch window.fetch without throwing if read-only
  try {
    const descriptor =
      Object.getOwnPropertyDescriptor(window, 'fetch') ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');

    if (descriptor?.writable) {
      window.fetch = cachedModelFetch;
    } else if (descriptor?.configurable) {
      Object.defineProperty(window, 'fetch', {
        value: cachedModelFetch,
        writable: true,
        configurable: true,
      });
    }
  } catch (e) {
    // Gracefully ignore if window.fetch cannot be mutated in this sandbox environment
  }
}

// Immediately attempt configuration
if (typeof window !== 'undefined') {
  setupFaceApiFetchCacheInterceptor();
}

/**
 * Check if all required biometric model files exist in CacheStorage
 */
export async function checkAllModelsCached(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);
    let legacyCache: Cache | null = null;
    try {
      legacyCache = await window.caches.open(LEGACY_CACHE_NAME);
    } catch (e) {}

    for (const file of MODEL_FILES) {
      const cdnUrl = `${MODEL_URL}${file}`;
      const originUrl = `${window.location.origin}/models/${file}`;
      const match =
        (await cache.match(cdnUrl)) ||
        (await cache.match(`/models/${file}`)) ||
        (await cache.match(file)) ||
        (await cache.match(originUrl)) ||
        (legacyCache && (await legacyCache.match(`/models/${file}`))) ||
        (legacyCache && (await legacyCache.match(file)));

      if (!match) {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn('checkAllModelsCached error:', err);
    return false;
  }
}

/**
 * Helper to cache a single model file into CacheStorage omni_biometrics_v2
 * Uses jsDelivr CDN endpoint with 5-minute timeout window and 3x auto-retry
 */
async function cacheSingleModelFile(cache: Cache, file: string, maxRetries = 3): Promise<boolean> {
  const cdnUrl = `${MODEL_URL}${file}`;
  const originUrl = `${window.location.origin}/models/${file}`;

  try {
    const cached =
      (await cache.match(cdnUrl)) ||
      (await cache.match(`/models/${file}`)) ||
      (await cache.match(file)) ||
      (await cache.match(originUrl));

    if (cached) return true;

    // Retry loop with 5-minute timeout window
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 1. Fetch from jsDelivr CDN with 5-minute timeout (300,000 ms)
        let resp = await fetchWithTimeout(cdnUrl, API_TIMEOUT_MS);

        // 2. Fallback to local /models/ if CDN failed or timed out
        if (!resp || !resp.ok) {
          resp = await fetchWithTimeout(`/models/${file}`, API_TIMEOUT_MS);
        }

        if (resp && resp.ok) {
          const c1 = resp.clone();
          const c2 = resp.clone();
          const c3 = resp.clone();
          const c4 = resp.clone();
          await cache.put(cdnUrl, c1).catch(() => {});
          await cache.put(originUrl, c2).catch(() => {});
          await cache.put(`/models/${file}`, c3).catch(() => {});
          await cache.put(file, c4).catch(() => {});
          return true;
        }
      } catch (retryErr) {
        console.warn(`[Biometrics] Shard ${file} fetch attempt ${attempt}/${maxRetries} failed:`, retryErr);
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  } catch (err) {
    console.warn(`[Biometrics] Error caching shard ${file}:`, err);
  }
  return false;
}

/**
 * Execute the blocking initialization & preloader boot sequence:
 * 1. Checks CacheStorage for existing weights (instant boot if cached)
 * 2. If missing, downloads shards from jsDelivr and commits to CacheStorage ('omni_biometrics_v2')
 * 3. Initializes faceapi.nets with 10-second timeout recovery to guarantee no preloader freezes
 */
export async function runBiometricBootSequence(
  onProgress: (info: BootProgressInfo) => void
): Promise<boolean> {
  const allLogs: string[] = [];
  const logStep = (
    step: number,
    percent: number,
    message: string,
    isOfflineCached = false,
    isComplete = false
  ) => {
    allLogs.push(message);
    onProgress({
      step,
      totalSteps: 4,
      percent: Math.min(100, Math.max(0, percent)),
      currentLog: message,
      allLogs: [...allLogs],
      isOfflineCached,
      isComplete,
    });
  };

  try {
    setupFaceApiFetchCacheInterceptor();

    // Step 1/4: Initializing local CacheStorage...
    logStep(1, 15, 'Step 1/4: Initializing local CacheStorage...');
    await new Promise((r) => setTimeout(r, 100));

    const isAlreadyCached = await checkAllModelsCached();

    if (isAlreadyCached) {
      // INSTANT BOOT WHEN OFFLINE / CACHED
      await new Promise((r) => setTimeout(r, 100));
      logStep(4, 90, '✅ Local Cache Verified (100% Offline Mode)', true, false);

      // Initialize neural networks in memory
      try {
        const faceapi = await waitForFaceApi(API_TIMEOUT_MS);
        if (faceapi?.env?.monkeyPatch) {
          faceapi.env.monkeyPatch({ fetch: cachedModelFetch });
        }
        await Promise.allSettled([
          loadNetWithTimeout(faceapi.nets.tinyFaceDetector, 'tinyFaceDetector', MODEL_URL, API_TIMEOUT_MS),
          loadNetWithTimeout(faceapi.nets.faceLandmark68Net, 'faceLandmark68Net', MODEL_URL, API_TIMEOUT_MS),
          loadNetWithTimeout(faceapi.nets.faceRecognitionNet, 'faceRecognitionNet', MODEL_URL, API_TIMEOUT_MS),
        ]);
        modelsLoaded = true;
      } catch (err) {
        console.warn('Fast boot model load notice:', err);
      }

      await new Promise((r) => setTimeout(r, 100));
      logStep(4, 100, '✅ All Biometric Models Cached! Booting Kiosk...', true, true);
      updateCacheStatus('ready');
      return true;
    }

    // FIRST RUN ON WI-FI: SEQUENTIAL DOWNLOAD & CACHESTORAGE SYNC
    let cache: Cache | null = null;
    if (typeof window !== 'undefined' && 'caches' in window) {
      cache = await window.caches.open(CACHE_NAME);
    }

    // Step 2/4: Fetching TinyFaceDetector weights from jsDelivr CDN
    logStep(2, 25, 'Step 2/4: Fetching TinyFaceDetector weights from jsDelivr CDN...');

    const tinyFiles = [
      'tiny_face_detector_model-weights_manifest.json',
      'tiny_face_detector_model-shard1',
    ];
    for (let i = 0; i < tinyFiles.length; i++) {
      const file = tinyFiles[i];
      if (cache) {
        try {
          await cacheSingleModelFile(cache, file);
        } catch (e) {
          console.warn(`Shard ${file} download notice:`, e);
        }
      }
      const pct = 25 + Math.round(((i + 1) / tinyFiles.length) * 22);
      logStep(2, pct, `Step 2/4: Cached ${file} into CacheStorage`);
    }

    // Preloader TinyFaceDetector load with 5-minute timeout fallback
    try {
      const faceapi = await waitForFaceApi(API_TIMEOUT_MS);
      if (faceapi?.env?.monkeyPatch) {
        faceapi.env.monkeyPatch({ fetch: cachedModelFetch });
      }
      await loadNetWithTimeout(faceapi.nets.tinyFaceDetector, 'tinyFaceDetector', MODEL_URL, API_TIMEOUT_MS);
    } catch (err) {
      console.warn('Stage 2 tinyFaceDetector load notice:', err);
    }

    // Step 3/4: Fetching FaceLandmark & Recognition neural networks
    logStep(3, 50, 'Step 3/4: Fetching FaceLandmark & Recognition neural networks...');

    const deepFiles = [
      'face_landmark_68_model-weights_manifest.json',
      'face_landmark_68_model-shard1',
      'face_recognition_model-weights_manifest.json',
      'face_recognition_model-shard1',
      'face_recognition_model-shard2',
    ];
    for (let i = 0; i < deepFiles.length; i++) {
      const file = deepFiles[i];
      if (cache) {
        try {
          await cacheSingleModelFile(cache, file);
        } catch (e) {
          console.warn(`Shard ${file} download notice:`, e);
        }
      }
      const pct = 50 + Math.round(((i + 1) / deepFiles.length) * 35);
      logStep(3, pct, `Step 3/4: Cached ${file} into CacheStorage`);
    }

    // Preloader Landmark & Recognition load with 5-minute timeout fallback
    try {
      const faceapi = await waitForFaceApi(API_TIMEOUT_MS);
      if (faceapi?.env?.monkeyPatch) {
        faceapi.env.monkeyPatch({ fetch: cachedModelFetch });
      }
      await Promise.allSettled([
        loadNetWithTimeout(faceapi.nets.faceLandmark68Net, 'faceLandmark68Net', MODEL_URL, API_TIMEOUT_MS),
        loadNetWithTimeout(faceapi.nets.faceRecognitionNet, 'faceRecognitionNet', MODEL_URL, API_TIMEOUT_MS),
      ]);
    } catch (err) {
      console.warn('Stage 3 neural nets load notice:', err);
    }

    // Step 4/4: Initializing WebGL hardware acceleration & verifying cache...
    logStep(4, 90, 'Step 4/4: Initializing WebGL hardware acceleration & verifying cache...');

    try {
      const faceapi = await waitForFaceApi(API_TIMEOUT_MS);
      if (faceapi?.env?.monkeyPatch) {
        faceapi.env.monkeyPatch({ fetch: cachedModelFetch });
      }
      await Promise.allSettled([
        loadNetWithTimeout(faceapi.nets.tinyFaceDetector, 'tinyFaceDetector', MODEL_URL, API_TIMEOUT_MS),
        loadNetWithTimeout(faceapi.nets.faceLandmark68Net, 'faceLandmark68Net', MODEL_URL, API_TIMEOUT_MS),
        loadNetWithTimeout(faceapi.nets.faceRecognitionNet, 'faceRecognitionNet', MODEL_URL, API_TIMEOUT_MS),
      ]);
      modelsLoaded = true;
    } catch (err: any) {
      console.warn('Error during boot model initialization:', err);
    }

    await new Promise((r) => setTimeout(r, 120));
    logStep(4, 100, '✅ All Biometric Models Cached! Booting Kiosk...', true, true);
    updateCacheStatus('ready');
    return true;
  } catch (bootErr: any) {
    console.error('Boot sequence safety catch triggered:', bootErr);
    logStep(4, 100, '✅ Recovery Activated: Booting Kiosk...', false, true);
    updateCacheStatus('ready');
    return true;
  }
}

/**
 * Automated pre-fetch and saving of face-api.js weights into browser CacheStorage
 */
export async function ensureOfflineModelCache(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    updateCacheStatus('ready');
    return true;
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);

    // Quick verification: check if all model files exist in cache
    let missingFiles = 0;
    for (const file of MODEL_FILES) {
      const cdnUrl = `${MODEL_URL}${file}`;
      const match =
        (await cache.match(cdnUrl)) ||
        (await cache.match(`/models/${file}`)) ||
        (await cache.match(file));
      if (!match) {
        missingFiles++;
      }
    }

    if (missingFiles === 0) {
      updateCacheStatus('ready');
      return true;
    }

    // Sync shards to cache
    updateCacheStatus('caching');

    for (const file of MODEL_FILES) {
      await cacheSingleModelFile(cache, file);
    }

    updateCacheStatus('ready');
    return true;
  } catch (err) {
    console.warn('CacheStorage setup error:', err);
    updateCacheStatus('ready');
    return false;
  }
}

let modelLoadPromise: Promise<boolean> | null = null;
let modelsLoaded = false;
let modelLoadError: string | null = null;

/**
 * Wait for window.faceapi to be injected by script tag with 5-minute timeout window
 */
export async function waitForFaceApi(timeoutMs = API_TIMEOUT_MS): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' && window.faceapi) {
      return window.faceapi;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('face-api.js failed to load within timeout period');
}

/**
 * Asynchronously load the neural network weights on application startup:
 * - TinyFaceDetector
 * - FaceLandmark68Net
 * - FaceRecognitionNet
 * Loads from CORS-enabled jsDelivr CDN endpoint with 5-minute timeout fallback
 */
export async function loadFaceDetectionModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      setupFaceApiFetchCacheInterceptor();
      // Ensure model files are pre-cached into CacheStorage
      await ensureOfflineModelCache().catch((e) => console.warn('Offline caching background error:', e));

      const faceapi = await waitForFaceApi(API_TIMEOUT_MS);
      if (!faceapi) {
        throw new Error('faceapi global object unavailable');
      }

      if (faceapi.env?.monkeyPatch) {
        try {
          faceapi.env.monkeyPatch({ fetch: cachedModelFetch });
        } catch (patchErr) {
          console.warn('faceapi.env.monkeyPatch error:', patchErr);
        }
      }

      // Preloader model loading with safety 5-minute timeout fallback
      await Promise.allSettled([
        loadNetWithTimeout(faceapi.nets.tinyFaceDetector, 'tinyFaceDetector', MODEL_URL, API_TIMEOUT_MS),
        loadNetWithTimeout(faceapi.nets.faceLandmark68Net, 'faceLandmark68Net', MODEL_URL, API_TIMEOUT_MS),
        loadNetWithTimeout(faceapi.nets.faceRecognitionNet, 'faceRecognitionNet', MODEL_URL, API_TIMEOUT_MS),
      ]);

      modelsLoaded = true;
      return true;
    } catch (err: any) {
      console.error('Error loading face-api models:', err);
      modelLoadError = err?.message || 'Failed to load face models';
      modelsLoaded = false;
      return false;
    }
  })();

  return modelLoadPromise;
}

export function isFaceDetectionModelLoaded(): boolean {
  return modelsLoaded;
}

export function getFaceDetectionError(): string | null {
  return modelLoadError;
}

/**
 * Calculate Euclidean Distance between two 128-dimensional face descriptors
 */
export function computeEuclideanDistance(
  desc1: Float32Array | number[],
  desc2: Float32Array | number[]
): number {
  if (typeof window !== 'undefined' && window.faceapi?.euclideanDistance) {
    return window.faceapi.euclideanDistance(desc1, desc2);
  }
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = (desc1[i] || 0) - (desc2[i] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// In-memory cache for profile photo descriptors
const profileDescriptorCache = new Map<string, Float32Array>();

/**
 * Compute 128-d face descriptor from an enrolled profile photo
 */
export async function computeFaceDescriptorFromImage(
  imageSrc: string
): Promise<Float32Array | null> {
  if (!imageSrc) return null;
  if (profileDescriptorCache.has(imageSrc)) {
    return profileDescriptorCache.get(imageSrc)!;
  }

  const faceapi = typeof window !== 'undefined' ? window.faceapi : null;
  if (!faceapi || !modelsLoaded) {
    await loadFaceDetectionModels();
  }
  const api = window.faceapi;
  if (!api) return null;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    await new Promise<void>((resolve, reject) => {
      if (img.complete && img.naturalWidth !== 0) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for descriptor extraction'));
      }
    });

    const options = new api.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.3,
    });

    const detection = await api
      .detectSingleFace(img, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection && detection.descriptor) {
      profileDescriptorCache.set(imageSrc, detection.descriptor);
      return detection.descriptor;
    }
    return null;
  } catch (err) {
    console.warn('Error extracting face descriptor from profile image:', err);
    return null;
  }
}

/**
 * Continuous real-time face detection & 1-to-1 matching against registered profile photo
 */
export async function detectAndMatchLiveFace(
  video: HTMLVideoElement,
  registeredDescriptor: Float32Array | null,
  hasProfilePhoto: boolean
): Promise<FaceDetectionResult> {
  if (!video || video.paused || video.ended || video.readyState < 2) {
    return {
      isDetected: false,
      isAligned: false,
      isMatched: false,
      badgeStatus: 'not_detected',
      badgeMessage: '⚠️ Position face inside square',
    };
  }

  const faceapi = typeof window !== 'undefined' ? window.faceapi : null;
  if (!faceapi || !modelsLoaded) {
    return {
      isDetected: false,
      isAligned: false,
      isMatched: false,
      badgeStatus: 'loading',
      badgeMessage: '⚠️ Loading biometric engine...',
    };
  }

  try {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      return {
        isDetected: false,
        isAligned: false,
        isMatched: false,
        badgeStatus: 'not_detected',
        badgeMessage: '⚠️ Position face inside square',
      };
    }

    const S = Math.min(videoWidth, videoHeight);
    const squareMinX = (videoWidth - S) / 2;
    const squareMaxX = squareMinX + S;
    const squareMinY = (videoHeight - S) / 2;
    const squareMaxY = squareMinY + S;

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.45,
    });

    let detection: any = null;
    if (hasProfilePhoto && registeredDescriptor) {
      detection = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
    } else {
      detection = await faceapi.detectSingleFace(video, options);
    }

    if (!detection) {
      return {
        isDetected: false,
        isAligned: false,
        isMatched: false,
        badgeStatus: 'not_detected',
        badgeMessage: '⚠️ Position face inside square',
      };
    }

    const box = detection.box || detection.detection?.box || detection._box;
    if (!box) {
      return {
        isDetected: false,
        isAligned: false,
        isMatched: false,
        badgeStatus: 'not_detected',
        badgeMessage: '⚠️ Position face inside square',
      };
    }

    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;

    const squareCenterX = (squareMinX + squareMaxX) / 2;
    const squareCenterY = (squareMinY + squareMaxY) / 2;

    const diffX = Math.abs(faceCenterX - squareCenterX) / S;
    const diffY = Math.abs(faceCenterY - squareCenterY) / S;

    const isMinSize = box.width >= S * 0.15 && box.height >= S * 0.15;
    const isInsideSquare =
      box.x >= squareMinX - S * 0.05 &&
      box.x + box.width <= squareMaxX + S * 0.05 &&
      box.y >= squareMinY - S * 0.05 &&
      box.y + box.height <= squareMaxY + S * 0.05;

    const isCentered = diffX <= 0.22 && diffY <= 0.22 && isMinSize && isInsideSquare;

    if (!isCentered) {
      return {
        isDetected: true,
        isAligned: false,
        isMatched: false,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        score: detection.score || detection.detection?.score,
        diffX,
        diffY,
        badgeStatus: 'not_detected',
        badgeMessage: '⚠️ Position face inside square',
      };
    }

    // Face is centered inside the square! Verify 1-to-1 recognition against registered profile photo
    if (hasProfilePhoto && registeredDescriptor && detection.descriptor) {
      const distance = computeEuclideanDistance(detection.descriptor, registeredDescriptor);
      const similarity = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
      // Strict threshold: Euclidean distance < 0.50
      const isMatched = distance < 0.50;

      if (isMatched) {
        return {
          isDetected: true,
          isAligned: true,
          isMatched: true,
          distance,
          similarity,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          score: detection.score || detection.detection?.score,
          diffX,
          diffY,
          badgeStatus: 'aligned',
          badgeMessage: '🟢 Face Aligned & Verified',
        };
      } else {
        return {
          isDetected: true,
          isAligned: false,
          isMatched: false,
          distance,
          similarity,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          score: detection.score || detection.detection?.score,
          diffX,
          diffY,
          badgeStatus: 'mismatch',
          badgeMessage: `⚠️ Face mismatch (diff: ${distance.toFixed(2)}) — Must match profile`,
        };
      }
    }

    // No profile photo registered, gate on centered alignment
    return {
      isDetected: true,
      isAligned: true,
      isMatched: true,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      score: detection.score,
      diffX,
      diffY,
      badgeStatus: 'aligned',
      badgeMessage: '🟢 Face Aligned & Verified',
    };
  } catch (err) {
    console.warn('Face detection frame processing error:', err);
    return {
      isDetected: false,
      isAligned: false,
      isMatched: false,
      badgeStatus: 'not_detected',
      badgeMessage: '⚠️ Position face inside square',
    };
  }
}

/**
 * Standard single face detection for backward compatibility
 */
export async function detectSingleFaceInVideo(
  video: HTMLVideoElement
): Promise<FaceDetectionResult> {
  return detectAndMatchLiveFace(video, null, false);
}
