import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AttendanceLog, AttendanceStatus, RosterFolder, RosterMember } from '../types';
import {
  calculateAttendanceStatus,
  formatShiftDisplay,
  formatTime12h,
  formatDateIso,
  captureVideoFrameAsThumbnail,
} from '../utils/storage';
import { sounds } from '../utils/audio';
import {
  detectAndMatchLiveFace,
  computeFaceDescriptorFromImage,
  FaceDetectionResult,
  loadFaceDetectionModels,
} from '../utils/faceDetection';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  CameraOff,
  ShieldCheck,
  ScanFace,
} from 'lucide-react';

interface PinModalProps {
  member: RosterMember | null;
  roster: RosterFolder | null;
  existingLog: AttendanceLog | null;
  currentClock: Date;
  onClose: () => void;
  onSuccess: (newLog: AttendanceLog) => void;
  onErrorToast: (title: string, message: string) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  member,
  roster,
  existingLog,
  currentClock,
  onClose,
  onSuccess,
  onErrorToast,
}) => {
  // State
  const [pin, setPin] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState<AttendanceStatus | null>(null);

  // Live Camera & Face Detection Gating
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState<boolean>(false);

  // Real-time Face Gating State
  const [faceStatus, setFaceStatus] = useState<FaceDetectionResult>({
    isDetected: false,
    isAligned: false,
    isMatched: false,
    badgeStatus: 'not_detected',
    badgeMessage: '⚠️ Position face inside square',
  });

  // Enrolled profile face descriptor (for 1-to-1 matching)
  const [registeredDescriptor, setRegisteredDescriptor] = useState<Float32Array | null>(null);

  // Pre-extract enrolled profile descriptor when modal opens
  useEffect(() => {
    if (!member?.profilePhotoBase64) {
      setRegisteredDescriptor(null);
      return;
    }

    let isSubscribed = true;
    computeFaceDescriptorFromImage(member.profilePhotoBase64)
      .then((desc) => {
        if (isSubscribed && desc) {
          setRegisteredDescriptor(desc);
        }
      })
      .catch((err) => {
        console.warn('Could not extract registered face descriptor:', err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [member]);

  // Emergency bypass fallback only if hardware camera is completely offline or blocked
  const [cameraBypassUnlocked, setCameraBypassUnlocked] = useState<boolean>(false);

  // Effective alignment: active face centered in square AND 1-to-1 matched (if enrolled photo exists)
  const isFaceAligned =
    (member?.profilePhotoBase64
      ? faceStatus.isAligned && faceStatus.isMatched
      : faceStatus.isAligned) || cameraBypassUnlocked;

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Initialize front-facing webcam on mount if not already checked in
  useEffect(() => {
    setPin('');
    setIsShaking(false);
    setIsVerifying(false);
    setVerifiedSuccess(null);
    setFlashActive(false);
    setCameraBypassUnlocked(false);
    setFaceStatus({
      isDetected: false,
      isAligned: false,
      isMatched: false,
      badgeStatus: 'not_detected',
      badgeMessage: '⚠️ Position face inside square',
    });

    // Ensure models are loading/loaded
    loadFaceDetectionModels().catch(() => {});

    if (existingLog || !member) {
      return;
    }

    let isMounted = true;
    setCameraError(null);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 480 },
            height: { ideal: 480 },
          },
          audio: false,
        })
        .then((stream) => {
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setCameraActive(true);
          setCameraError(null);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Front camera not available or declined:', err);
          if (isMounted) {
            setCameraActive(false);
            setCameraError('Camera offline or blocked');
          }
        });
    } else {
      setCameraActive(false);
      setCameraError('Camera API unsupported');
    }

    return () => {
      isMounted = false;
      stopCameraStream();
    };
  }, [member, existingLog, stopCameraStream]);

  // CONTINUOUS REAL-TIME FACE DETECTION & 1-TO-1 MATCHING GATING LOOP
  useEffect(() => {
    if (!cameraActive || existingLog || verifiedSuccess) return;

    let isSubscribed = true;
    let isDetecting = false;

    const detectLoopInterval = setInterval(async () => {
      if (!videoRef.current || isDetecting || !isSubscribed) return;
      if (videoRef.current.readyState < 2) return;

      isDetecting = true;
      try {
        const hasPhoto = Boolean(member?.profilePhotoBase64);
        const result = await detectAndMatchLiveFace(
          videoRef.current,
          registeredDescriptor,
          hasPhoto
        );
        if (isSubscribed) {
          setFaceStatus(result);
        }
      } catch (err) {
        console.warn('Face detection frame error:', err);
      } finally {
        isDetecting = false;
      }
    }, 120);

    return () => {
      isSubscribed = false;
      clearInterval(detectLoopInterval);
    };
  }, [cameraActive, existingLog, verifiedSuccess, member, registeredDescriptor]);

  // Keypad input handlers (Gated by face alignment & 1-to-1 match)
  const handleInputDigit = useCallback(
    (digit: string) => {
      if (!isFaceAligned) {
        sounds.playErrorBuzz();
        if (faceStatus.badgeStatus === 'mismatch') {
          onErrorToast(
            'Face Mismatch',
            'Biometric verification failed. Face does not match registered profile photo (diff >= 0.50).'
          );
        } else {
          onErrorToast(
            'Face Not Aligned',
            'Please position your face inside the green square to unlock keypad.'
          );
        }
        return;
      }
      if (pin.length >= 4 || isVerifying || verifiedSuccess || existingLog) return;
      sounds.playKeyClick();
      setPin((prev) => (prev.length < 4 ? prev + digit : prev));
    },
    [
      isFaceAligned,
      pin,
      isVerifying,
      verifiedSuccess,
      existingLog,
      faceStatus.badgeStatus,
      onErrorToast,
    ]
  );

  const handleBackspace = useCallback(() => {
    if (isVerifying || verifiedSuccess || existingLog) return;
    sounds.playKeyClick();
    setPin((prev) => prev.slice(0, -1));
  }, [isVerifying, verifiedSuccess, existingLog]);

  const handleClear = useCallback(() => {
    if (isVerifying || verifiedSuccess || existingLog) return;
    sounds.playKeyClick();
    setPin('');
  }, [isVerifying, verifiedSuccess, existingLog]);

  // Keyboard hardware listener
  useEffect(() => {
    if (!member) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCameraStream();
        onClose();
        return;
      }

      if (!existingLog && !verifiedSuccess) {
        if (e.key >= '0' && e.key <= '9') {
          if (isFaceAligned) {
            handleInputDigit(e.key);
          }
        } else if (e.key === 'Backspace') {
          handleBackspace();
        } else if (e.key === 'Delete') {
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    member,
    existingLog,
    verifiedSuccess,
    isFaceAligned,
    handleInputDigit,
    handleBackspace,
    handleClear,
    onClose,
    stopCameraStream,
  ]);

  // Gated verification executor
  const executeVerification = useCallback(
    (enteredPin: string) => {
      if (!member || !roster) return;

      // Gate: Face MUST be aligned and 1-to-1 matched
      if (!isFaceAligned) {
        sounds.playErrorBuzz();
        if (faceStatus.badgeStatus === 'mismatch') {
          onErrorToast(
            'Biometric Mismatch',
            '1-to-1 face recognition failed. Euclidean distance must be < 0.50 to submit PIN.'
          );
        } else {
          onErrorToast(
            'Face Not Centered',
            'Please position your face inside the green square to verify.'
          );
        }
        return;
      }

      setIsVerifying(true);

      // If PIN does not match
      if (enteredPin !== member.pin) {
        setTimeout(() => {
          sounds.playErrorBuzz();
          setIsShaking(true);
          onErrorToast('Incorrect PIN', `Invalid 4-digit PIN entered for ${member.name}.`);
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
            setIsVerifying(false);
          }, 450);
        }, 100);
        return;
      }

      // PIN is correct and face is locked green! Capture snapshot & calculate attendance
      sounds.playCameraShutter();
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 120);

      // Capture lightweight base64 thumbnail (~160x120 JPEG format)
      let liveSnapshotBase64 = '';
      if (videoRef.current && cameraActive) {
        liveSnapshotBase64 = captureVideoFrameAsThumbnail(videoRef.current, 160, 120, 0.75);
      }

      // Stop camera hardware tracks immediately
      stopCameraStream();

      // Calculate attendance punctuality math:
      // If current_time < shiftStart -> Status: "EARLY"
      // If shiftStart <= current_time <= (shiftStart + graceMin) -> Status: "ON_TIME"
      // If current_time > (shiftStart + graceMin) -> Status: "LATE"
      const status = calculateAttendanceStatus(currentClock, roster.shiftStart, roster.graceMin);
      sounds.playSuccessChime();
      setVerifiedSuccess(status);

      const shiftFormatted = `${formatShiftDisplay(roster.shiftStart)} - ${formatShiftDisplay(
        roster.shiftEnd
      )}`;

      const verifiedMethod = liveSnapshotBase64
        ? member.profilePhotoBase64 && faceStatus.isMatched
          ? `1-to-1 Face Verified (${faceStatus.similarity ? `${faceStatus.similarity}%` : '<0.50'}) + PIN`
          : 'Live Face Detection + Device PIN'
        : 'Local Device PIN Verified';

      const verifiedLog: AttendanceLog = {
        id: Date.now(),
        rosterId: roster.id,
        rosterName: roster.name,
        memberId: member.id,
        name: member.name,
        customVal: member.customVal,
        date: formatDateIso(currentClock),
        time: formatTime12h(currentClock),
        status: status,
        verifiedMethod: verifiedMethod,
        liveSnapshotBase64: liveSnapshotBase64 || undefined,
        registeredPhotoBase64: member.profilePhotoBase64,
        shiftWindow: shiftFormatted,
      };

      // Close modal after brief feedback and update main table row immediately
      setTimeout(() => {
        onSuccess(verifiedLog);
      }, 400);
    },
    [
      member,
      roster,
      isFaceAligned,
      faceStatus.badgeStatus,
      faceStatus.isMatched,
      faceStatus.similarity,
      cameraActive,
      currentClock,
      onErrorToast,
      onSuccess,
      stopCameraStream,
    ]
  );

  // Automatic PIN submission: ONLY triggers when PIN has 4 digits AND face is aligned green!
  useEffect(() => {
    if (
      pin.length === 4 &&
      member &&
      roster &&
      !isVerifying &&
      !verifiedSuccess &&
      !existingLog
    ) {
      if (isFaceAligned) {
        executeVerification(pin);
      }
      // If NOT aligned, automatic PIN submission is strictly BLOCKED.
    }
  }, [pin, isFaceAligned, member, roster, isVerifying, verifiedSuccess, existingLog, executeVerification]);

  if (!member || !roster) return null;

  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="pin-kiosk-modal"
        className={`w-full max-w-sm glass-modal rounded-3xl p-5 sm:p-6 flex flex-col items-center relative text-center border border-white/15 shadow-2xl transition-all ${
          isShaking ? 'animate-pin-shake ring-2 ring-rose-500' : ''
        }`}
      >
        {/* Flash Overlay for Shutter Effect */}
        {flashActive && (
          <div className="absolute inset-0 bg-white z-50 rounded-3xl pointer-events-none animate-out fade-out duration-150" />
        )}

        {/* Close Button */}
        <button
          onClick={() => {
            stopCameraStream();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header: Member Badge */}
        <div className="flex items-center gap-3 w-full pb-3 border-b border-white/10 text-left">
          {member.profilePhotoBase64 ? (
            <img
              src={member.profilePhotoBase64}
              alt={member.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/50 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-emerald-300 font-display font-bold text-sm shrink-0">
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-base text-white truncate">
              {member.name}
            </h3>
            <p className="text-xs text-slate-400 truncate flex items-center gap-1">
              <Building className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>{roster.name}</span>
              {member.customVal && (
                <>
                  <span>•</span>
                  <span className="text-slate-300 font-medium">{member.customVal}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Shift Details Banner */}
        <div className="mt-2 w-full py-1.5 px-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between text-xs text-slate-300 font-mono">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {formatShiftDisplay(roster.shiftStart)} - {formatShiftDisplay(roster.shiftEnd)}
            </span>
          </div>
          <span className="text-[11px] text-amber-400 font-sans font-bold">
            {roster.graceMin}m Grace
          </span>
        </div>

        {/* ================================================================ */}
        {/* CASE A: MEMBER ALREADY VERIFIED TODAY                            */}
        {/* ================================================================ */}
        {existingLog && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-800/90 border border-emerald-500/40 w-full text-xs text-slate-200 space-y-3">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Already Verified Today</span>
            </div>

            {existingLog.liveSnapshotBase64 && (
              <div className="mx-auto w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500/60 shadow-md">
                <img
                  src={existingLog.liveSnapshotBase64}
                  alt="Live Snapshot"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div>
              Status: <strong className="text-white">{existingLog.status}</strong> at{' '}
              <strong className="text-white">{existingLog.time}</strong>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* CASE B: LIVE CAMERA VIEW + ACTIVE FACE DETECTION GATING          */}
        {/* ================================================================ */}
        {!existingLog && (
          <div className="w-full flex flex-col items-center mt-2">
            {/* LARGE MODERN SQUARE VIEWFINDER (240x240) */}
            <div
              id="kiosk-square-viewfinder"
              style={{
                width: '240px',
                height: '240px',
                borderRadius: '20px',
                border: isFaceAligned ? '2.5px solid #10b981' : '2.5px solid #f43f5e',
                boxShadow: isFaceAligned
                  ? '0 0 20px rgba(16, 185, 129, 0.4)'
                  : '0 0 20px rgba(244, 63, 94, 0.4)',
              }}
              className="relative overflow-hidden bg-slate-900 flex items-center justify-center my-2 transition-all duration-200 shrink-0 select-none"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%',
                  borderRadius: '20px',
                }}
                className={`transform -scale-x-100 ${
                  cameraActive ? 'opacity-100' : 'opacity-0 absolute'
                }`}
              />

              {/* Biometric Corner Brackets (Glowing Green or Red) */}
              <div
                style={{
                  borderColor: isFaceAligned ? '#10b981' : '#f43f5e',
                  filter: isFaceAligned
                    ? 'drop-shadow(0 0 4px #10b981)'
                    : 'drop-shadow(0 0 4px #f43f5e)',
                }}
                className="absolute top-2.5 left-2.5 w-6 h-6 border-t-[3px] border-l-[3px] rounded-tl-[8px] pointer-events-none transition-all duration-200"
              />
              <div
                style={{
                  borderColor: isFaceAligned ? '#10b981' : '#f43f5e',
                  filter: isFaceAligned
                    ? 'drop-shadow(0 0 4px #10b981)'
                    : 'drop-shadow(0 0 4px #f43f5e)',
                }}
                className="absolute top-2.5 right-2.5 w-6 h-6 border-t-[3px] border-r-[3px] rounded-tr-[8px] pointer-events-none transition-all duration-200"
              />
              <div
                style={{
                  borderColor: isFaceAligned ? '#10b981' : '#f43f5e',
                  filter: isFaceAligned
                    ? 'drop-shadow(0 0 4px #10b981)'
                    : 'drop-shadow(0 0 4px #f43f5e)',
                }}
                className="absolute bottom-2.5 left-2.5 w-6 h-6 border-b-[3px] border-l-[3px] rounded-bl-[8px] pointer-events-none transition-all duration-200"
              />
              <div
                style={{
                  borderColor: isFaceAligned ? '#10b981' : '#f43f5e',
                  filter: isFaceAligned
                    ? 'drop-shadow(0 0 4px #10b981)'
                    : 'drop-shadow(0 0 4px #f43f5e)',
                }}
                className="absolute bottom-2.5 right-2.5 w-6 h-6 border-b-[3px] border-r-[3px] rounded-br-[8px] pointer-events-none transition-all duration-200"
              />

              {/* Subtle inner alignment target frame */}
              <div
                className={`absolute inset-5 rounded-[12px] border border-dashed pointer-events-none transition-colors duration-200 ${
                  isFaceAligned ? 'border-emerald-400/40' : 'border-rose-400/30'
                }`}
              />

              {/* Camera Active Status Indicator */}
              {cameraActive && (
                <div
                  className={`absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full border border-slate-950 animate-pulse ${
                    isFaceAligned ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
              )}

              {/* Camera Fallback / Blocked View */}
              {(!cameraActive || cameraError) && (
                <div className="p-3 text-center flex flex-col items-center justify-center text-slate-400 z-10">
                  <CameraOff className="w-8 h-8 mb-2 text-slate-400" />
                  <span className="text-xs text-slate-400 font-sans leading-tight">
                    {cameraError || 'Loading camera...'}
                  </span>
                  {cameraError && !cameraBypassUnlocked && (
                    <button
                      type="button"
                      onClick={() => setCameraBypassUnlocked(true)}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono border border-white/10 cursor-pointer"
                    >
                      Bypass Camera
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* REAL-TIME FACE ALIGNMENT STATUS BADGE */}
            {verifiedSuccess ? (
              <div className="my-1 py-1 px-3 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 animate-in zoom-in-95">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {verifiedSuccess === 'ON_TIME' && '🟢 Verified On Time'}
                  {verifiedSuccess === 'LATE' && '🟡 Verified Late'}
                  {verifiedSuccess === 'EARLY' && '🔵 Verified Early'}
                </span>
              </div>
            ) : isShaking ? (
              <p className="text-xs text-rose-400 font-bold my-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Incorrect PIN</span>
              </p>
            ) : (
              <div
                id="face-status-badge"
                className={`my-1 py-1 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-150 border ${
                  isFaceAligned
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : faceStatus.badgeStatus === 'mismatch'
                    ? 'bg-rose-500/25 text-rose-200 border-rose-500/60 shadow-sm animate-pulse'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                <span>
                  {isFaceAligned
                    ? '🟢 Face Aligned & Verified'
                    : faceStatus.badgeMessage || '⚠️ Position face inside square'}
                </span>
              </div>
            )}

            {/* 4-Dot Visual Indicator */}
            <div className="flex items-center justify-center gap-3.5 my-1.5">
              {[0, 1, 2, 3].map((index) => {
                const isFilled = index < pin.length;
                return (
                  <div
                    key={index}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-emerald-400 scale-125 shadow-[0_0_12px_#10b981] border border-emerald-300'
                        : 'bg-white/10 border border-white/20'
                    }`}
                  />
                );
              })}
            </div>

            {/* Lock helper text when face is not aligned or mismatched */}
            {!isFaceAligned && !verifiedSuccess && (
              <p className="text-[10px] text-rose-400/90 font-medium mb-1 flex items-center gap-1">
                <ScanFace className="w-3 h-3 text-rose-400 shrink-0" />
                <span>
                  {faceStatus.badgeStatus === 'mismatch'
                    ? 'Keypad locked: Face does not match registered profile'
                    : 'Keypad locked until face is inside square'}
                </span>
              </p>
            )}

            {/* 0-9 Numeric Keypad (UNLOCKED when face is centered green) */}
            <div
              className={`grid grid-cols-3 gap-2 w-full max-w-[240px] transition-opacity duration-200 ${
                isFaceAligned ? 'opacity-100' : 'opacity-50'
              }`}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  id={`pin-key-${digit}`}
                  type="button"
                  disabled={!isFaceAligned || isVerifying || !!verifiedSuccess}
                  onClick={() => handleInputDigit(digit)}
                  className={`h-10 sm:h-11 rounded-xl border text-white font-display text-lg font-bold transition-all duration-100 flex items-center justify-center shadow-sm ${
                    isFaceAligned
                      ? 'bg-white/5 hover:bg-white/15 active:bg-emerald-500/30 border-white/10 active:scale-95 cursor-pointer'
                      : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {digit}
                </button>
              ))}

              {/* Clear Button */}
              <button
                id="pin-key-clear"
                type="button"
                onClick={handleClear}
                className="h-10 sm:h-11 rounded-xl bg-white/5 hover:bg-white/15 active:bg-white/20 border border-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-all duration-100 flex items-center justify-center active:scale-95 cursor-pointer"
              >
                Clear
              </button>

              {/* 0 Button */}
              <button
                id="pin-key-0"
                type="button"
                disabled={!isFaceAligned || isVerifying || !!verifiedSuccess}
                onClick={() => handleInputDigit('0')}
                className={`h-10 sm:h-11 rounded-xl border text-white font-display text-lg font-bold transition-all duration-100 flex items-center justify-center shadow-sm ${
                  isFaceAligned
                    ? 'bg-white/5 hover:bg-white/15 active:bg-emerald-500/30 border-white/10 active:scale-95 cursor-pointer'
                    : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                0
              </button>

              {/* Cancel Button */}
              <button
                id="pin-key-cancel"
                type="button"
                onClick={() => {
                  stopCameraStream();
                  onClose();
                }}
                className="h-10 sm:h-11 rounded-xl bg-white/5 hover:bg-white/15 active:bg-rose-500/20 border border-white/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-all duration-100 flex items-center justify-center active:scale-95 cursor-pointer"
                title="Cancel"
              >
                Cancel
              </button>
            </div>

            {/* Dedicated "Verify Attendance" Action Button */}
            <button
              id="btn-verify-pin"
              type="button"
              disabled={!isFaceAligned || pin.length !== 4 || isVerifying || !!verifiedSuccess}
              onClick={() => {
                if (isFaceAligned && pin.length === 4) {
                  executeVerification(pin);
                }
              }}
              className={`w-full max-w-[240px] mt-2.5 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isFaceAligned && pin.length === 4 && !isVerifying && !verifiedSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-950/80 active:scale-98'
                  : 'bg-slate-800/80 text-slate-500 border border-white/5 cursor-not-allowed opacity-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? 'Verifying Attendance...' : 'Verify Attendance'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
