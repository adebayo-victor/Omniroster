import * as faceapi from '@vladmandic/face-api';
import type { Employee } from './db';

let modelsLoaded = false;
let loadPromise: Promise<boolean> | null = null;

export const BIOMETRIC_MATCH_THRESHOLD = 0.48; // Euclidean distance < 0.48

/**
 * Loads TinyFaceDetector, FaceLandmark68Net, and FaceRecognitionNet from local /models directory
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('[Biometrics] Error loading models from /models:', err);
      modelsLoaded = false;
      throw err;
    }
  })();

  return loadPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

export function getTinyFaceDetectorOptions() {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  });
}

export async function detectFaceWithDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) {
  if (!modelsLoaded) {
    await loadFaceApiModels();
  }

  const options = getTinyFaceDetectorOptions();
  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection;
}

export interface BiometricMatchResult {
  employee: Employee;
  distance: number;
  confidence: number;
  isMatch: boolean;
}

export function matchDescriptorToEmployees(
  queryDescriptor: Float32Array | number[],
  employees: Employee[],
  maxDistance = BIOMETRIC_MATCH_THRESHOLD
): BiometricMatchResult | null {
  if (!queryDescriptor || employees.length === 0) return null;

  const queryArray =
    queryDescriptor instanceof Float32Array
      ? queryDescriptor
      : new Float32Array(queryDescriptor);

  let bestMatch: BiometricMatchResult | null = null;
  let lowestDistance = Infinity;

  for (const emp of employees) {
    if (!emp.faceDescriptor || emp.faceDescriptor.length !== 128) continue;

    const empArray = new Float32Array(emp.faceDescriptor);
    const distance = faceapi.euclideanDistance(queryArray, empArray);

    if (distance < lowestDistance) {
      lowestDistance = distance;
      const confidence = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));

      bestMatch = {
        employee: emp,
        distance,
        confidence,
        isMatch: distance < maxDistance,
      };
    }
  }

  return bestMatch;
}

export function drawBiometricHUD(
  canvas: HTMLCanvasElement,
  displayDims: { width: number; height: number },
  detection: any,
  matchResult: BiometricMatchResult | null,
  isScanning: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, displayDims.width, displayDims.height);
  if (!detection) return;

  const box = detection.box || detection.detection?.box;
  if (!box) return;

  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;

  const isMatched = matchResult?.isMatch;
  const primaryColor = isMatched
    ? 'rgba(16, 185, 129, 0.9)'
    : matchResult
    ? 'rgba(239, 68, 68, 0.8)'
    : 'rgba(6, 182, 212, 0.9)';

  const glowColor = isMatched
    ? 'rgba(16, 185, 129, 0.4)'
    : 'rgba(6, 182, 212, 0.3)';

  ctx.save();
  ctx.strokeStyle = primaryColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2.5;

  const cornerLength = Math.min(w, h) * 0.25;

  // Corner brackets
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLength);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLength, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - cornerLength, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLength);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLength);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLength, y + h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - cornerLength, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLength);
  ctx.stroke();

  // Floating Status Tag
  const tagText = isMatched
    ? `VERIFIED: ${(matchResult.employee.fullName || '').toUpperCase()} (${matchResult.confidence}%)`
    : matchResult
    ? 'NO MATCHING IDENTITY'
    : 'ANALYZING BIOMETRICS...';

  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  const textMetrics = ctx.measureText(tagText);
  const tagW = textMetrics.width + 20;
  const tagH = 24;
  const tagX = Math.max(8, Math.min(displayDims.width - tagW - 8, x + w / 2 - tagW / 2));
  const tagY = Math.max(tagH + 4, y - 10);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY - tagH, tagW, tagH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = primaryColor;
  ctx.fillText(tagText, tagX + 10, tagY - 7);
  ctx.restore();
}
