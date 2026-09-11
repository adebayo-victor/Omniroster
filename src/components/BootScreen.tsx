import React, { useState, useEffect, useRef } from 'react';
import { runBiometricBootSequence, BootProgressInfo } from '../utils/faceDetection';
import { ShieldCheck, Cpu, HardDrive, WifiOff, CheckCircle2, Sparkles } from 'lucide-react';

interface BootScreenProps {
  onBootComplete: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  const [bootInfo, setBootInfo] = useState<BootProgressInfo>({
    step: 1,
    totalSteps: 4,
    percent: 0,
    currentLog: 'Step 1/4: Initializing local CacheStorage...',
    allLogs: ['Step 1/4: Initializing local CacheStorage...'],
    isOfflineCached: false,
    isComplete: false,
  });

  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log to bottom on each message
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bootInfo.allLogs]);

  // Execute Boot Sequence on Mount
  useEffect(() => {
    let isMounted = true;

    const startBoot = async () => {
      try {
        await runBiometricBootSequence((update) => {
          if (!isMounted) return;
          setBootInfo(update);

          if (update.isComplete) {
            // Trigger smooth dissolution
            setTimeout(() => {
              if (isMounted) {
                setIsFadingOut(true);
                setTimeout(() => {
                  if (isMounted) {
                    onBootComplete();
                  }
                }, 500); // 500ms fade duration
              }
            }, 300);
          }
        });
      } catch (err) {
        console.error('Boot sequence error:', err);
        if (isMounted) {
          setIsFadingOut(true);
          setTimeout(() => onBootComplete(), 500);
        }
      }
    };

    startBoot();

    return () => {
      isMounted = false;
    };
  }, [onBootComplete]);

  return (
    <div
      id="omniroster-boot-overlay"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-8 bg-[#07090e] text-slate-100 select-none overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#07090e',
      }}
    >
      {/* High-tech Subtle Radial Gradient & Cyber Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(6, 182, 212, 0.15), transparent 60%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1), transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.2) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
        {/* Brand System Chip */}
        <div className="flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-400 text-xs font-mono tracking-widest uppercase shadow-lg shadow-cyan-950/40">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span>SYSTEM KERNEL // BIO-ENGINE OS</span>
        </div>

        {/* Brand Header */}
        <h1
          id="boot-screen-title"
          className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white text-center mb-2 drop-shadow-sm flex items-center justify-center gap-2 flex-wrap"
        >
          <span className="text-amber-400">⚡</span>
          <span>OmniRoster OS</span>
          <span className="text-slate-500 hidden sm:inline">—</span>
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Biometric Kiosk Initialization
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 text-center max-w-md mb-8">
          Autonomous duty roster management & 1-to-1 facial recognition engine.
          Preloading neural weights into browser CacheStorage for 100% offline verification.
        </p>

        {/* Visual Progress Bar Section */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {bootInfo.percent === 100
                  ? 'Biometrics Ready'
                  : `Stage ${bootInfo.step} of ${bootInfo.totalSteps}`}
              </span>
            </span>
            <span className="font-display font-bold text-lg text-emerald-400 tabular-nums">
              {bootInfo.percent}%
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-3.5 bg-slate-950 rounded-full p-0.5 border border-slate-700/60 overflow-hidden relative shadow-inner">
            <div
              id="boot-progress-fill"
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300 ease-out shadow-sm shadow-emerald-500/50 relative overflow-hidden"
              style={{ width: `${bootInfo.percent}%` }}
            >
              {/* Shimmer / light sweep animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full" />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-slate-400">
            <span className="truncate pr-2">
              <span className="text-cyan-400 font-semibold">&gt; </span>
              {bootInfo.currentLog}
            </span>
            <span className="text-slate-400 shrink-0">
              {bootInfo.isOfflineCached
                ? 'Local Cache'
                : bootInfo.percent === 100
                ? 'Verified'
                : 'Storage Sync'}
            </span>
          </div>
        </div>

        {/* Real-time Status Terminal Log */}
        <div className="w-full bg-black/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl mb-6">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-[11px] font-mono font-medium text-slate-400 ml-2">
                TERMINAL OUTPUT: TELEMETRY STREAM
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
              <Sparkles className="w-3 h-3" />
              <span>CACHE_V2</span>
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div
            id="boot-terminal-log"
            className="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700"
          >
            {bootInfo.allLogs.map((log, index) => {
              const isSuccess = log.includes('✅');
              const isStep = log.startsWith('Step');

              return (
                <div
                  key={index}
                  className={`flex items-start gap-2 leading-relaxed ${
                    isSuccess
                      ? 'text-emerald-300 font-semibold'
                      : isStep
                      ? 'text-cyan-300 font-medium'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="text-slate-600 select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
            <div className="text-cyan-400/80 animate-pulse flex items-center gap-1 mt-1">
              <span>&gt;</span>
              <span className="inline-block w-2 h-3.5 bg-cyan-400/80 ml-0.5" />
            </div>
          </div>
        </div>

        {/* Offline Architecture Hardware Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Cache: omni_biometrics_v2</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
            <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">100% Airplane Mode Ready</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">1-to-1 Facial Euclidean Gate</span>
          </div>
        </div>
      </div>
    </div>
  );
};
