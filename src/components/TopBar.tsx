import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  ShieldCheck,
  WifiOff,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  FileCode,
} from 'lucide-react';
import { downloadStandaloneHtmlFile } from '../utils/standaloneHtmlGenerator';
import {
  subscribeBiometricCacheStatus,
  getBiometricCacheStatus,
  BiometricCacheStatus,
} from '../utils/faceDetection';

interface TopBarProps {
  onOpenAdmin: () => void;
  customClockTime: Date | null;
  onSetCustomClockTime: (d: Date | null) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenAdmin,
  customClockTime,
  onSetCustomClockTime,
}) => {
  const [timeStr, setTimeStr] = useState<string>('12:00:00 AM');
  const [dateStr, setDateStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [simHour, setSimHour] = useState<string>('07:35');
  const [biometricCacheStatus, setBiometricCacheStatus] = useState<BiometricCacheStatus>(
    getBiometricCacheStatus()
  );

  // Subscribe to Biometric Engine CacheStorage status
  useEffect(() => {
    const unsubscribe = subscribeBiometricCacheStatus((status) => {
      setBiometricCacheStatus(status);
    });
    return unsubscribe;
  }, []);

  // Clock updating mechanism
  useEffect(() => {
    const update = () => {
      const now = customClockTime ? new Date(customClockTime) : new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTimeStr(`${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`);

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      };
      setDateStr(now.toLocaleDateString(undefined, options));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [customClockTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const applySimulatedTime = (timeHHMM: string) => {
    const [h, m] = timeHHMM.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    onSetCustomClockTime(d);
    setShowSimModal(false);
  };

  const resetToRealTime = () => {
    onSetCustomClockTime(null);
    setShowSimModal(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Brand & Status badges */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-900/30 border border-emerald-400/40 shrink-0">
              <span className="font-display font-black text-xl text-white tracking-tighter">OR</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-lg tracking-tight text-white">
                  OmniRoster
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Kiosk v2.5
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Universal Offline Duty Roster & PIN Attendance
              </p>
            </div>
          </div>

          {/* Visual Offline Readiness & Storage Indicator Badge */}
          <div className="flex items-center gap-2">
            {biometricCacheStatus === 'caching' ? (
              <div
                id="badge-biometric-offline-readiness"
                title="Automated one-time pre-fetch: Caching face-api.js neural weights into browser CacheStorage"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/90 text-amber-300 border border-amber-500/50 shadow-sm animate-pulse whitespace-nowrap"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                </span>
                <span>⏳ Caching Biometric Engine (5MB)...</span>
              </div>
            ) : (
              <div
                id="badge-biometric-offline-readiness"
                title="Face-api model weights permanently stored in browser CacheStorage. 100% Offline in Airplane Mode."
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm whitespace-nowrap"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>🟢 100% Offline Biometrics Ready</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Clock & Date Section */}
        <div className="flex items-center gap-4 py-1 px-4 rounded-xl bg-slate-900/80 border border-white/5 shadow-inner">
          <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
            <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-medium whitespace-nowrap">{dateStr}</span>
          </div>
          <div className="h-4 w-px bg-slate-700/60" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <span className="font-display text-base sm:text-xl font-bold tracking-wider text-emerald-300 tabular-nums">
              {timeStr}
            </span>
          </div>
          {customClockTime && (
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
              SIMULATED
            </span>
          )}
        </div>

        {/* Quick Actions & Admin Portal */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
          {/* Clock Simulator Trigger */}
          <button
            id="btn-clock-sim"
            onClick={() => setShowSimModal(!showSimModal)}
            title="Simulate Clock Time (Test Early / On Time / Late)"
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              customClockTime
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                : 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700 text-slate-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden lg:inline">Test Clock</span>
          </button>

          {/* Standalone HTML Kiosk Export */}
          <button
            id="btn-export-standalone-top"
            onClick={downloadStandaloneHtmlFile}
            title="Export 100% self-contained single-file HTML kiosk to run anywhere"
            className="p-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs transition-all"
          >
            <FileCode className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Fullscreen Kiosk Toggle */}
          <button
            id="btn-fullscreen-toggle"
            onClick={toggleFullscreen}
            title="Toggle Kiosk Fullscreen"
            className="p-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Admin Portal Button */}
          <button
            id="btn-open-admin-portal"
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/60 border border-emerald-400/40 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            <span>Admin Portal</span>
          </button>
        </div>
      </div>

      {/* Clock Simulation Popover / Quick Modal */}
      {showSimModal && (
        <div className="mt-3 p-3 bg-slate-900/95 border border-amber-500/40 rounded-xl shadow-2xl max-w-lg mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-amber-200 font-medium">
            <span className="font-bold">Test Shift Lateness:</span> Pick a simulated hour to verify Early/Late logic without waiting.
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={simHour}
              onChange={(e) => setSimHour(e.target.value)}
              className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-white font-mono"
            />
            <button
              onClick={() => applySimulatedTime(simHour)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold"
            >
              Set Time
            </button>
            {customClockTime && (
              <button
                onClick={resetToRealTime}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
              >
                Reset to Live
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
