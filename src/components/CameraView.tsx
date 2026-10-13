import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Camera, CameraOff, RefreshCw, AlertCircle } from 'lucide-react';
import {
  loadFaceApiModels,
  detectFaceWithDescriptor,
  drawBiometricHUD,
  type BiometricMatchResult,
} from '../utils/biometrics';

export interface CameraViewRef {
  takeSnapshot: () => string | null;
  restartCamera: () => Promise<void>;
}

interface CameraViewProps {
  onFaceDetected?: (
    detection: any,
    descriptor: Float32Array,
    snapshotBase64: string
  ) => void;
  onFaceLost?: () => void;
  matchResult?: BiometricMatchResult | null;
  isProcessing?: boolean;
}

export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  ({ onFaceDetected, onFaceLost, matchResult, isProcessing = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const loopTimerRef = useRef<number | null>(null);
    const isDetectingRef = useRef<boolean>(false);

    const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [modelsReady, setModelsReady] = useState<boolean>(false);
    const [hasFace, setHasFace] = useState<boolean>(false);

    // Snapshot helper
    const takeSnapshot = useCallback((): string | null => {
      if (!videoRef.current || videoRef.current.readyState < 2) return null;
      const video = videoRef.current;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = video.videoWidth || 640;
      snapCanvas.height = video.videoHeight || 480;
      const ctx = snapCanvas.getContext('2d');
      if (!ctx) return null;

      // Draw normal unmirrored or mirrored snapshot
      ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
      return snapCanvas.toDataURL('image/jpeg', 0.85);
    }, []);

    useImperativeHandle(ref, () => ({
      takeSnapshot,
      restartCamera: async () => {
        await startCamera();
      },
    }));

    // Start video stream
    const startCamera = async () => {
      setCameraError(null);
      setIsCameraReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Camera access denied or unavailable.';
        setCameraError(message);
        setIsCameraReady(false);
      }
    };

    // Load models on mount
    useEffect(() => {
      let isMounted = true;
      loadFaceApiModels()
        .then(() => {
          if (isMounted) setModelsReady(true);
        })
        .catch((err) => {
          console.error('Failed to load biometric models:', err);
        });

      return () => {
        isMounted = false;
      };
    }, []);

    // Start camera once mounted
    useEffect(() => {
      startCamera();

      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (loopTimerRef.current) {
          cancelAnimationFrame(loopTimerRef.current);
          loopTimerRef.current = null;
        }
      };
    }, []);

    // Biometric detection loop
    useEffect(() => {
      if (!isCameraReady || !modelsReady) return;

      let lastRun = 0;
      const intervalMs = 150; // Optimized throttle for smooth mobile execution

      const runDetectionLoop = async (time: number) => {
        if (time - lastRun >= intervalMs) {
          lastRun = time;

          if (
            videoRef.current &&
            videoRef.current.readyState >= 2 &&
            !isDetectingRef.current &&
            !isProcessing
          ) {
            isDetectingRef.current = true;
            try {
              const video = videoRef.current;
              const canvas = canvasRef.current;

              if (canvas) {
                const displayDims = {
                  width: video.clientWidth || 480,
                  height: video.clientHeight || 360,
                };

                if (
                  canvas.width !== displayDims.width ||
                  canvas.height !== displayDims.height
                ) {
                  canvas.width = displayDims.width;
                  canvas.height = displayDims.height;
                }

                const result = await detectFaceWithDescriptor(video);

                if (result) {
                  setHasFace(true);
                  drawBiometricHUD(
                    canvas,
                    displayDims,
                    result,
                    matchResult || null,
                    true
                  );

                  if (result.descriptor && onFaceDetected) {
                    const snap = takeSnapshot() || '';
                    onFaceDetected(result, result.descriptor, snap);
                  }
                } else {
                  setHasFace(false);
                  const ctx = canvas.getContext('2d');
                  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                  if (onFaceLost) onFaceLost();
                }
              }
            } catch (err) {
              console.warn('[CameraView] Detection frame error:', err);
            } finally {
              isDetectingRef.current = false;
            }
          }
        }

        loopTimerRef.current = requestAnimationFrame(runDetectionLoop);
      };

      loopTimerRef.current = requestAnimationFrame(runDetectionLoop);

      return () => {
        if (loopTimerRef.current) {
          cancelAnimationFrame(loopTimerRef.current);
          loopTimerRef.current = null;
        }
      };
    }, [isCameraReady, modelsReady, matchResult, isProcessing, onFaceDetected, onFaceLost, takeSnapshot]);

    return (
      <div className="relative w-full aspect-4/3 max-w-lg mx-auto bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
        {/* Live Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            isCameraReady ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-300`}
        />

        {/* HUD Detection Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Futuristic Grid & Reticle Overlay */}
        {isCameraReady && (
          <div className="absolute inset-0 pointer-events-none z-5 flex items-center justify-center">
            {/* Corner Markers */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-500/40" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-500/40" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-500/40" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-500/40" />

            {/* Target Reticle Oval for User Framing */}
            <div
              className={`w-48 h-64 rounded-[50%] border border-dashed transition-all duration-300 ${
                hasFace
                  ? matchResult?.isMatch
                    ? 'border-emerald-400/80 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : 'border-cyan-400/80 bg-cyan-500/5'
                  : 'border-slate-500/30'
              }`}
            />
          </div>
        )}

        {/* Biometric Scanning Line Sweep Animation */}
        {isCameraReady && modelsReady && (
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none z-10 animate-pulse top-1/2 -translate-y-1/2" />
        )}

        {/* Loading / Model Initializing State */}
        {(!isCameraReady || !modelsReady) && !cameraError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-200">
              {!isCameraReady
                ? 'Initializing Optical Feed...'
                : 'Loading Biometric Neural Nets (Offline /models)...'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              TinyFaceDetector 224px • 128-D Vector Engine
            </p>
          </div>
        )}

        {/* Camera Permission / Error Fallback */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-3">
              <CameraOff className="w-6 h-6 text-rose-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-200">Camera Feed Blocked</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              {cameraError}
            </p>
            <button
              onClick={startCamera}
              className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 rounded-lg transition inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Camera Permission
            </button>
          </div>
        )}

        {/* Small floating camera refresh button in top right of feed */}
        {isCameraReady && (
          <button
            onClick={startCamera}
            title="Restart or reset optical camera stream"
            className="absolute top-3 right-3 z-20 p-2 rounded-lg bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-700/60 backdrop-blur transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

CameraView.displayName = 'CameraView';
