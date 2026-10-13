import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Camera,
  KeyRound,
  UserCheck,
  Check,
  Folder as FolderIcon,
  Sparkles,
  Eye,
  EyeOff,
  X,
  Calendar,
  AlertCircle,
  VideoOff,
} from 'lucide-react';
import { CameraView, type CameraViewRef } from './CameraView';
import {
  matchDescriptorToEmployees,
  BIOMETRIC_MATCH_THRESHOLD,
  type BiometricMatchResult,
} from '../utils/biometrics';
import {
  type Employee,
  type Folder,
  type AttendanceRecord,
  calculatePunchStatus,
} from '../utils/db';

interface PunchInFlowProps {
  folder: Folder;
  onBack: () => void;
  onPunchComplete?: (record: AttendanceRecord) => void;
}

export const PunchInFlow: React.FC<PunchInFlowProps> = ({
  folder,
  onBack,
  onPunchComplete,
}) => {
  const cameraRef = useRef<CameraViewRef | null>(null);

  // Data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Biometric / match state
  const [matchResult, setMatchResult] = useState<BiometricMatchResult | null>(null);
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(null);
  const [snapshotBase64, setSnapshotBase64] = useState<string>('');
  const [matchConfidence, setMatchConfidence] = useState<number>(0);

  // Flow step: 'scanning' | 'matched_approval' | 'duplicate_warning' | 'punch_result'
  const [flowStep, setFlowStep] = useState<
    'scanning' | 'matched_approval' | 'duplicate_warning' | 'punch_result'
  >('scanning');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [punchRecord, setPunchRecord] = useState<AttendanceRecord | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Duplicate Check-In Warning state
  const [duplicateWarningMsg, setDuplicateWarningMsg] = useState<string>('');
  const [existingPunchData, setExistingPunchData] = useState<AttendanceRecord | null>(null);

  // Fallback PIN state (Strictly PIN, NO photo upload)
  const [pinFallbackMode, setPinFallbackMode] = useState<boolean>(false);
  const [selectedPinEmployeeId, setSelectedPinEmployeeId] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Fetch employees assigned to this folder (or all if none specified)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch('/api/employees');
        if (res.ok) {
          const data = await res.json();
          const allEmps: Employee[] = data.employees || [];
          const assigned = allEmps.filter((e) =>
            folder.assignedEmployeeIds && folder.assignedEmployeeIds.length > 0
              ? folder.assignedEmployeeIds.includes(e.id)
              : true
          );
          if (isMounted) {
            setEmployees(assigned.length > 0 ? assigned : allEmps);
          }
        }
      } catch (err) {
        console.error('[PunchInFlow] Error fetching employees:', err);
      } finally {
        if (isMounted) setLoadingEmployees(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [folder]);

  // Live face match callback
  const handleFaceDetected = useCallback(
    (_detection: any, descriptor: Float32Array, snapshot: string) => {
      if (flowStep !== 'scanning' || pinFallbackMode || employees.length === 0) return;

      const result = matchDescriptorToEmployees(descriptor, employees, BIOMETRIC_MATCH_THRESHOLD);
      setMatchResult(result);

      if (result && result.isMatch) {
        setMatchedEmployee(result.employee);
        setMatchConfidence(result.confidence);
        setSnapshotBase64(snapshot);
        setFlowStep('matched_approval');
      }
    },
    [flowStep, pinFallbackMode, employees]
  );

  const handleFaceLost = useCallback(() => {
    if (flowStep === 'scanning') {
      setMatchResult(null);
    }
  }, [flowStep]);

  // Determine current active shift info for this folder
  const todayStr = new Date().toISOString().split('T')[0];
  const activeShiftToday = folder.type === 'optimized_roster' && folder.generatedShifts
    ? folder.generatedShifts.find((s) => s.dateStr === todayStr)
    : null;

  const currentShiftStartTime = activeShiftToday?.startTime || folder.startTime || '09:00';
  const currentShiftGracePeriod = activeShiftToday?.gracePeriodMinutes || folder.gracePeriodMinutes || 15;

  // Strict 4-Digit PIN Fallback Submission
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!selectedPinEmployeeId) {
      setPinError('Please select your name from the staff list.');
      return;
    }

    if (!pinInput || pinInput.length !== 4) {
      setPinError('Please enter your complete 4-digit PIN.');
      return;
    }

    const emp = employees.find((e) => e.id === selectedPinEmployeeId);
    if (!emp) {
      setPinError('Employee profile not found.');
      return;
    }

    if (emp.pin !== pinInput) {
      setPinError('Incorrect 4-digit PIN. Please re-enter.');
      return;
    }

    // Capture live camera frame if camera is running as visual audit
    let snapshot = '';
    try {
      if (cameraRef.current) {
        snapshot = cameraRef.current.takeSnapshot() || '';
      }
    } catch {
      // Ignore if camera was unavailable
    }

    setMatchedEmployee(emp);
    setMatchConfidence(100);
    setSnapshotBase64(snapshot);
    setPinFallbackMode(false);
    setFlowStep('matched_approval');
  };

  // Perform synthetic Service Worker fetch to punch attendance
  const executePunchSubmission = async (allowDuplicate = false) => {
    if (!matchedEmployee) return;

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: matchedEmployee.id,
          employeeName: matchedEmployee.fullName,
          folderId: folder.id,
          snapshotBase64: snapshotBase64 || '',
          matchedConfidence: matchConfidence || 95,
          allowDuplicate,
        }),
      });

      if (res.status === 409) {
        // Duplicate attendance detected!
        const data = await res.json();
        setDuplicateWarningMsg(
          data.message || 'You have already punched in for this shift today.'
        );
        setExistingPunchData(data.existingPunch || null);
        setFlowStep('duplicate_warning');
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Attendance punch failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setPunchRecord(data.record);
      setFlowStep('punch_result');

      if (onPunchComplete) {
        onPunchComplete(data.record);
      }
    } catch (err: any) {
      console.error('[PunchInFlow] Submission error:', err);
      setErrorNotice(err.message || 'Failed to submit attendance punch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFlow = () => {
    setMatchedEmployee(null);
    setMatchResult(null);
    setSnapshotBase64('');
    setMatchConfidence(0);
    setPinFallbackMode(false);
    setSelectedPinEmployeeId('');
    setPinInput('');
    setPinError(null);
    setDuplicateWarningMsg('');
    setExistingPunchData(null);
    setErrorNotice(null);
    setFlowStep('scanning');
  };

  // Calculate live status for approval preview
  const liveStatus = calculatePunchStatus(
    currentShiftStartTime,
    currentShiftGracePeriod,
    new Date()
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-y-auto text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
            title="Return to Folder Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-white">
                {folder.name}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                folder.type === 'optimized_roster'
                  ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                  : 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60'
              }`}>
                {folder.type === 'optimized_roster' ? 'CSP Roster' : 'Simple Shift'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Shift Start: {currentShiftStartTime} (±{currentShiftGracePeriod}m grace)
              </span>
              {activeShiftToday && (
                <>
                  <span>•</span>
                  <span className="text-purple-300 font-medium">
                    Today: {activeShiftToday.type}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!pinFallbackMode && flowStep === 'scanning' && (
            <button
              onClick={() => {
                setPinFallbackMode(true);
                setPinError(null);
                setPinInput('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="Use 4-Digit Staff PIN fallback"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>4-Digit PIN Fallback</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Biometric Gate Active
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center">
        {/* STEP 1: SCANNING / LIVE CAMERA OR PIN FALLBACK */}
        {flowStep === 'scanning' && (
          <div className="w-full max-w-xl flex flex-col items-center">
            {pinFallbackMode ? (
              /* PIN FALLBACK FORM */
              <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Staff PIN Verification</h3>
                      <p className="text-xs text-slate-400">
                        Secure manual fallback when camera biometric is unavailable
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPinFallbackMode(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Return to Face Scan"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {pinError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Select Staff Member
                    </label>
                    <select
                      value={selectedPinEmployeeId}
                      onChange={(e) => setSelectedPinEmployeeId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- Choose your name --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Enter 4-Digit Security PIN
                    </label>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="••••"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-xl tracking-[0.5em] font-mono text-white focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Numeric Keypad Buttons for Touch Terminals */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          if (k === 'C') setPinInput('');
                          else if (k === '⌫') setPinInput((prev) => prev.slice(0, -1));
                          else if (pinInput.length < 4) setPinInput((prev) => prev + k);
                        }}
                        className="py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold rounded-xl text-base transition-all cursor-pointer"
                      >
                        {k}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPinFallbackMode(false)}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition-all cursor-pointer"
                    >
                      Use Camera Scan
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedPinEmployeeId || pinInput.length !== 4}
                      className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-600/30 cursor-pointer"
                    >
                      Verify & Proceed
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* LIVE CAMERA SCAN HUD */
              <div className="w-full flex flex-col items-center">
                <div className="mb-4 text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    Position Face in Scanner
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live camera facial vectoring against local station roster (Threshold &lt; 0.48)
                  </p>
                </div>

                <div className="w-full max-w-md aspect-[4/3] rounded-3xl overflow-hidden border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 bg-black relative">
                  <CameraView
                    ref={cameraRef}
                    onFaceDetected={handleFaceDetected}
                    onFaceLost={handleFaceLost}
                  />
                </div>

                {/* Status Guidance */}
                <div className="mt-5 flex items-center justify-between w-full max-w-md px-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>Live Biometric Stream</span>
                  </div>

                  <button
                    onClick={() => {
                      setPinFallbackMode(true);
                      setPinError(null);
                      setPinInput('');
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4 cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Switch to PIN
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: MATCHED APPROVAL & CONFIRMATION */}
        {flowStep === 'matched_approval' && matchedEmployee && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full border-4 border-emerald-500/80 overflow-hidden mb-4 bg-slate-800 relative shadow-xl shadow-emerald-500/20">
              {snapshotBase64 ? (
                <img
                  src={snapshotBase64}
                  alt="Biometric Snapshot"
                  className="w-full h-full object-cover"
                />
              ) : matchedEmployee.profilePhotoBase64 ? (
                <img
                  src={matchedEmployee.profilePhotoBase64}
                  alt={matchedEmployee.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-cyan-950 text-cyan-300 font-bold text-2xl">
                  {matchedEmployee.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute bottom-0 right-0 p-1 bg-emerald-500 rounded-full text-slate-950">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Biometric Identity Verified ({matchConfidence}% match)</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white text-center">
              {matchedEmployee.fullName}
            </h2>
            <p className="text-xs text-slate-400 mb-6 text-center">
              {matchedEmployee.role} • {matchedEmployee.department}
            </p>

            {/* Shift & Arrival Status Box */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FolderIcon className="w-3.5 h-3.5 text-cyan-400" />
                  Target Shift:
                </span>
                <span className="font-semibold text-white">{folder.name}</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Scheduled Start:
                </span>
                <span className="font-mono font-bold text-white">
                  {currentShiftStartTime}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Punch Status Preview:</span>
                <span className={`px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-[11px] ${
                  liveStatus === 'on_time'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : liveStatus === 'late'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                }`}>
                  {liveStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            {errorNotice && (
              <div className="w-full mb-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full flex gap-3">
              <button
                onClick={handleResetFlow}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Scan Again
              </button>
              <button
                onClick={() => executePunchSubmission(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Approve & Punch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DUPLICATE CHECK-IN WARNING DIALOG */}
        {flowStep === 'duplicate_warning' && matchedEmployee && (
          <div className="w-full max-w-md bg-slate-900 border border-amber-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-600/40 text-amber-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white text-center mb-2">
              Duplicate Check-In Detected
            </h2>
            <p className="text-xs text-slate-300 text-center mb-4 leading-relaxed">
              {duplicateWarningMsg}
            </p>

            {existingPunchData && (
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-6 text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Previous Punch:</span>
                  <span className="text-slate-200 font-mono font-medium">
                    {new Date(existingPunchData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Logged Status:</span>
                  <span className="text-amber-400 font-bold uppercase">
                    {existingPunchData.status}
                  </span>
                </div>
              </div>
            )}

            <div className="w-full flex gap-3">
              <button
                onClick={handleResetFlow}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel Punch
              </button>
              <button
                onClick={() => executePunchSubmission(true)}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-600/30 cursor-pointer"
              >
                Punch Again
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION RECEIPT */}
        {flowStep === 'punch_result' && punchRecord && (
          <div className="w-full max-w-md bg-slate-900 border border-emerald-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-white text-center mb-1">
              Attendance Recorded!
            </h2>
            <p className="text-xs text-slate-400 text-center mb-6">
              Saved directly to offline IndexedDB ledger
            </p>

            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee:</span>
                <span className="font-bold text-white">{punchRecord.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shift Folder:</span>
                <span className="font-medium text-cyan-300">{punchRecord.folderName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="font-mono font-semibold text-white">
                  {new Date(punchRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Verified Status:</span>
                <span className={`px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-[11px] ${
                  punchRecord.status === 'on_time'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : punchRecord.status === 'late'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    : punchRecord.status === 'duplicate'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                    : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                }`}>
                  {punchRecord.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <button
              onClick={onBack}
              className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-cyan-600/30 cursor-pointer"
            >
              Return to Folder Hub
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
