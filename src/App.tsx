import React, { useState, useEffect } from 'react';
import {
  AttendanceLog,
  RosterFolder,
  RosterMember,
  ToastMessage,
} from './types';
import {
  loadRosters,
  saveRosters,
  loadAttendanceLogs,
  recordAttendanceLog,
  saveAttendanceLogs,
  DEMO_ROSTERS,
  formatDateIso,
} from './utils/storage';
import { TopBar } from './components/TopBar';
import { FolderSelector } from './components/FolderSelector';
import { DutyBoard } from './components/DutyBoard';
import { PinModal } from './components/PinModal';
import { AdminModal } from './components/AdminModal';
import { ToastContainer } from './components/Toast';
import { BootScreen } from './components/BootScreen';
import { FolderPlus, ShieldCheck } from 'lucide-react';

export default function App() {
  // Bootloader State (Full-Screen Blocking Splash Screen)
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [isBootDissolved, setIsBootDissolved] = useState<boolean>(false);

  // Primary State
  const [rosters, setRosters] = useState<RosterFolder[]>([]);
  const [activeRosterId, setActiveRosterId] = useState<number | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  // Clock & Simulation
  const [customClockTime, setCustomClockTime] = useState<Date | null>(null);
  const [currentLiveClock, setCurrentLiveClock] = useState<Date>(new Date());

  // Modals & Overlays
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [selectedMemberForPin, setSelectedMemberForPin] = useState<RosterMember | null>(null);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initialize on mount from LocalStorage
  useEffect(() => {
    const loadedRosters = loadRosters();
    setRosters(loadedRosters);
    if (loadedRosters.length > 0) {
      setActiveRosterId(loadedRosters[0].id);
    }
    const loadedLogs = loadAttendanceLogs();
    setLogs(loadedLogs);
  }, []);

  // Sync Live Clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLiveClock(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // The active clock (either simulated or real)
  const effectiveClock = customClockTime || currentLiveClock;
  const todayIso = formatDateIso(effectiveClock);

  // Today's logs
  const todayLogs = logs.filter((l) => l.date === todayIso);

  // Toast Dispatcher
  const addToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastMessage = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Active Roster Object
  const activeRoster = rosters.find((r) => r.id === activeRosterId) || rosters[0] || null;

  // Handle Roster Updates from Admin
  const handleSaveRosters = (newRosters: RosterFolder[]) => {
    setRosters(newRosters);
    saveRosters(newRosters);
    if (newRosters.length > 0) {
      if (!activeRosterId || !newRosters.some((r) => r.id === activeRosterId)) {
        setActiveRosterId(newRosters[0].id);
      }
    } else {
      setActiveRosterId(0);
    }
  };

  // Handle Load Multi-Sector Demos
  const handleLoadDemos = () => {
    setRosters(DEMO_ROSTERS);
    saveRosters(DEMO_ROSTERS);
    if (DEMO_ROSTERS.length > 0) {
      setActiveRosterId(DEMO_ROSTERS[0].id);
    }
    addToast(
      'success',
      'Demo Suite Populated',
      'Loaded First Bank, FUMMSA Lab, and Corporate IT & Security rosters.'
    );
  };

  // Handle Clear Historical Logs
  const handleClearLogs = () => {
    saveAttendanceLogs([]);
    setLogs([]);
  };

  // Check if member already checked in today
  const getExistingLogForMember = (memberId: number): AttendanceLog | null => {
    if (!activeRoster) return null;
    return (
      todayLogs.find(
        (l) => l.rosterId === activeRoster.id && l.memberId === memberId && l.date === todayIso
      ) || null
    );
  };

  // Handle successful check-in
  const handleCheckInSuccess = (newLog: AttendanceLog) => {
    // Save to local storage
    const recorded = recordAttendanceLog(newLog);
    setLogs((prev) => [recorded, ...prev]);
    setSelectedMemberForPin(null);

    const statusBadge =
      recorded.status === 'ON_TIME'
        ? '🟢 ON TIME'
        : recorded.status === 'EARLY'
        ? '🔵 EARLY'
        : '🟡 LATE';

    addToast(
      'success',
      `${recorded.name} Verified`,
      `Attendance status: ${statusBadge} recorded at ${recorded.time}.`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white relative">
      {/* Full-Screen Blocking Boot / Splash Screen */}
      {!isBootDissolved && (
        <BootScreen
          onBootComplete={() => {
            setIsBooting(false);
            setTimeout(() => {
              setIsBootDissolved(true);
            }, 600);
          }}
        />
      )}

      {/* Main Kiosk Dashboard — Completely HIDDEN until all biometric models are downloaded & verified */}
      {!isBooting && (
        <div className="flex-1 flex flex-col transition-opacity duration-500 ease-in opacity-100">
          {/* Module 1: Top Bar with Live Clock, Date, Offline status, Admin button */}
          <TopBar
            onOpenAdmin={() => setIsAdminOpen(true)}
            customClockTime={customClockTime}
            onSetCustomClockTime={setCustomClockTime}
          />

          {/* Main Kiosk Stage */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex flex-col">
            {rosters.length === 0 ? (
              /* Pristine Empty State Card */
              <div className="w-full max-w-2xl mx-auto my-auto py-12 px-6 sm:px-10 glass-panel rounded-3xl border border-white/10 text-center space-y-6 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                  <FolderPlus className="w-8 h-8 text-emerald-400" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                    📁 No Active Rosters Found
                  </h2>
                  <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
                    Open Admin Control Center to create your first department folder.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    id="btn-empty-open-admin"
                    onClick={() => setIsAdminOpen(true)}
                    className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/80 transition-all flex items-center gap-2.5 mx-auto active:scale-95 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin Control Center</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Module 1: Folder / Department Selector */}
                <FolderSelector
                  rosters={rosters}
                  activeRosterId={activeRoster?.id || null}
                  onSelectRoster={(id) => setActiveRosterId(id)}
                  onOpenNewFolderModal={() => setIsAdminOpen(true)}
                />

                {/* Module 1: Daily Duty Timetable & Staff Cards */}
                <DutyBoard
                  activeRoster={activeRoster}
                  todayLogs={todayLogs}
                  onSelectMemberForCheckIn={(member) => setSelectedMemberForPin(member)}
                  onOpenAddStaff={() => setIsAdminOpen(true)}
                />
              </>
            )}
          </main>

          {/* Footer Kiosk Info */}
          <footer className="w-full border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              <span>OmniRoster Kiosk • 100% Offline LocalStorage Architecture</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Enterprise Duty Scheduling & Verification</span>
              <span>•</span>
              <button
                onClick={() => setIsAdminOpen(true)}
                className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
              >
                Admin Panel (Default: admin123)
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* Interactive PIN Verification Modal */}
      {selectedMemberForPin && (
        <PinModal
          member={selectedMemberForPin}
          roster={activeRoster}
          existingLog={getExistingLogForMember(selectedMemberForPin.id)}
          currentClock={effectiveClock}
          onClose={() => setSelectedMemberForPin(null)}
          onSuccess={handleCheckInSuccess}
          onErrorToast={(title, msg) => addToast('error', title, msg)}
        />
      )}

      {/* Admin Control Center Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        rosters={rosters}
        activeRosterId={activeRoster?.id || null}
        onSelectRoster={(id) => setActiveRosterId(id)}
        onSaveRosters={handleSaveRosters}
        logs={logs}
        onClearLogs={handleClearLogs}
        onLoadDemos={handleLoadDemos}
        onToast={addToast}
      />

      {/* Floating Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
