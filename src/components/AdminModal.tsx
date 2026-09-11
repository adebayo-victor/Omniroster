import React, { useState, useRef } from 'react';
import {
  AttendanceLog,
  RosterFolder,
  RosterMember,
} from '../types';
import {
  DEFAULT_ADMIN_PASSWORD,
  MASTER_RECOVERY_KEY,
  getAdminPassword,
  saveAdminPassword,
  exportAttendanceLogsToCsv,
  formatShiftDisplay,
  compressImageFile,
} from '../utils/storage';
import { downloadStandaloneHtmlFile } from '../utils/standaloneHtmlGenerator';
import {
  ShieldAlert,
  ShieldCheck,
  X,
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  Key,
  Eye,
  EyeOff,
  FolderPlus,
  Users,
  Clock,
  Sparkles,
  AlertTriangle,
  Search,
  CheckCircle,
  CheckCircle2,
  FileCode,
  Edit2,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosters: RosterFolder[];
  activeRosterId: number | null;
  onSelectRoster: (id: number) => void;
  onSaveRosters: (newRosters: RosterFolder[]) => void;
  logs: AttendanceLog[];
  onClearLogs: () => void;
  onLoadDemos: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

type AdminTab = 'ROSTERS' | 'STAFF' | 'LOGS' | 'SYSTEM';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  rosters,
  activeRosterId,
  onSelectRoster,
  onSaveRosters,
  logs,
  onClearLogs,
  onLoadDemos,
  onToast,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<AdminTab>('ROSTERS');

  // Roster Creation Form State
  const [newRosterName, setNewRosterName] = useState<string>('');
  const [newShiftStart, setNewShiftStart] = useState<string>('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState<string>('16:00');
  const [newGraceMin, setNewGraceMin] = useState<number>(10);
  const [newCustomCol, setNewCustomCol] = useState<string>('Station / Table No');

  // Staff Single Registration State
  const [singleName, setSingleName] = useState<string>('');
  const [singlePin, setSinglePin] = useState<string>('');
  const [singleCustom, setSingleCustom] = useState<string>('');
  const [singlePhotoBase64, setSinglePhotoBase64] = useState<string>('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const singlePhotoInputRef = useRef<HTMLInputElement>(null);

  // Member PIN visibility in registry
  const [revealedPins, setRevealedPins] = useState<Record<number, boolean>>({});

  // Editing Member State
  const [editingMember, setEditingMember] = useState<{
    id: number;
    name: string;
    pin: string;
    customVal: string;
  } | null>(null);

  // Logs Filtering
  const [logSearch, setLogSearch] = useState<string>('');
  const [logRosterFilter, setLogRosterFilter] = useState<string>('ALL');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AttendanceLog | null>(null);

  // Confirmation Modal for Clear Logs
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Confirmation Modal for Deleting Roster
  const [rosterToDelete, setRosterToDelete] = useState<{
    id: number;
    name: string;
    memberCount: number;
  } | null>(null);

  // Change Admin Password Form
  const [newAdminPwd, setNewAdminPwd] = useState<string>('');
  const [confirmAdminPwd, setConfirmAdminPwd] = useState<string>('');

  if (!isOpen) return null;

  const currentActiveRoster = rosters.find((r) => r.id === activeRosterId) || rosters[0];

  // Handle Login
  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPassword = getAdminPassword();
    const entered = passwordInput.trim();

    if (entered === storedPassword || entered === MASTER_RECOVERY_KEY) {
      setIsAuthenticated(true);
      setAuthError('');
      onToast('success', 'Admin Authenticated', 'Master control center unlocked.');
    } else {
      setAuthError(`Invalid credentials. Use default password or master recovery key (${MASTER_RECOVERY_KEY}).`);
    }
  };

  // Create Roster Folder
  const handleCreateRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRosterName.trim()) {
      onToast('error', 'Validation Error', 'Roster name is required.');
      return;
    }

    const newFolder: RosterFolder = {
      id: Date.now(),
      name: newRosterName.trim(),
      shiftStart: newShiftStart,
      shiftEnd: newShiftEnd,
      graceMin: Number(newGraceMin),
      customColName: newCustomCol.trim() || 'Custom Property',
      members: [],
    };

    const updated = [...rosters, newFolder];
    onSaveRosters(updated);
    onSelectRoster(newFolder.id);
    setNewRosterName('');
    onToast('success', 'Roster Created', `Folder "${newFolder.name}" is now ready.`);
  };

  // Delete Roster Folder
  const requestDeleteRoster = (id: number, name: string, memberCount: number) => {
    setRosterToDelete({ id, name, memberCount });
  };

  const executeDeleteRoster = () => {
    if (!rosterToDelete) return;
    const { id, name } = rosterToDelete;
    const updated = rosters.filter((r) => r.id !== id);
    onSaveRosters(updated);
    if (activeRosterId === id) {
      if (updated.length > 0) {
        onSelectRoster(updated[0].id);
      } else {
        onSelectRoster(0);
      }
    }
    setRosterToDelete(null);
    onToast('info', 'Roster Deleted', `Roster "${name}" has been permanently removed.`);
  };

  // Photo Selection and Canvas Compression for Quick Add
  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      const compressed = await compressImageFile(file, 150, 0.7);
      setSinglePhotoBase64(compressed);
      onToast('info', 'Photo Processed', 'Profile photo optimized to ~150x150 for offline storage.');
    } catch (err) {
      console.error(err);
      onToast('error', 'Image Error', 'Failed to process selected profile photo.');
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Single-Staff Registration with Photo
  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActiveRoster) {
      onToast('error', 'No Folder Selected', 'Please select or create a roster folder first.');
      return;
    }

    const cleanPin = singlePin.replace(/\D/g, '').slice(0, 4);
    if (!singleName.trim() || cleanPin.length !== 4) {
      onToast('error', 'Validation Error', 'Staff name and a 4-digit numeric PIN are required.');
      return;
    }

    const newMember: RosterMember = {
      id: Date.now(),
      name: singleName.trim(),
      pin: cleanPin,
      customVal: singleCustom.trim(),
      profilePhotoBase64: singlePhotoBase64 || undefined,
    };

    const updatedRosters = rosters.map((r) => {
      if (r.id === currentActiveRoster.id) {
        return {
          ...r,
          members: [...(r.members || []), newMember],
        };
      }
      return r;
    });

    onSaveRosters(updatedRosters);
    setSingleName('');
    setSinglePin('');
    setSingleCustom('');
    setSinglePhotoBase64('');
    if (singlePhotoInputRef.current) {
      singlePhotoInputRef.current.value = '';
    }
    onToast('success', 'Staff Member Registered', `${newMember.name} enrolled in ${currentActiveRoster.name}.`);
  };

  // Delete Member
  const handleDeleteMember = (memberId: number) => {
    if (!currentActiveRoster) return;
    const updatedRosters = rosters.map((r) => {
      if (r.id === currentActiveRoster.id) {
        return {
          ...r,
          members: (r.members || []).filter((m) => m.id !== memberId),
        };
      }
      return r;
    });
    onSaveRosters(updatedRosters);
    onToast('info', 'Member Removed', 'Staff member deleted from registry.');
  };

  // Update Member
  const handleSaveEditMember = () => {
    if (!editingMember || !currentActiveRoster) return;
    const cleanPin = editingMember.pin.replace(/\D/g, '').slice(0, 4);
    if (!editingMember.name.trim() || cleanPin.length !== 4) {
      onToast('error', 'Validation Error', 'Name and valid 4-digit PIN required.');
      return;
    }

    const updatedRosters = rosters.map((r) => {
      if (r.id === currentActiveRoster.id) {
        return {
          ...r,
          members: (r.members || []).map((m) =>
            m.id === editingMember.id
              ? {
                  ...m,
                  name: editingMember.name.trim(),
                  pin: cleanPin,
                  customVal: editingMember.customVal.trim(),
                }
              : m
          ),
        };
      }
      return r;
    });

    onSaveRosters(updatedRosters);
    setEditingMember(null);
    onToast('success', 'Member Updated', 'Staff credentials saved.');
  };

  // Toggle PIN visibility
  const togglePinReveal = (memberId: number) => {
    setRevealedPins((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  // Update Admin Password
  const handleChangeAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminPwd || newAdminPwd.length < 4) {
      onToast('error', 'Password Too Short', 'Admin password must be at least 4 characters.');
      return;
    }
    if (newAdminPwd !== confirmAdminPwd) {
      onToast('error', 'Mismatch', 'New password and confirmation do not match.');
      return;
    }

    saveAdminPassword(newAdminPwd);
    setNewAdminPwd('');
    setConfirmAdminPwd('');
    onToast('success', 'Password Updated', 'Admin credentials updated in localStorage.');
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.name.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.rosterName.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.customVal && log.customVal.toLowerCase().includes(logSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (logRosterFilter !== 'ALL' && String(log.rosterId) !== logRosterFilter) return false;
    if (logStatusFilter !== 'ALL' && log.status !== logStatusFilter) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg overflow-y-auto animate-in fade-in duration-200">
      <div
        id="admin-control-center"
        className="w-full max-w-5xl glass-modal rounded-3xl p-4 sm:p-7 border border-white/20 my-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center shadow-lg border border-cyan-400/40">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
                  Admin Control Center
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Offline Master
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Department schedules, staff rosters, PIN credentials & RFC 4180 audit logs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Close Admin portal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AUTHENTICATION SCREEN */}
        {!isAuthenticated ? (
          <div className="py-12 px-4 max-w-md mx-auto w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl shadow-emerald-950/40">
              <Key className="w-8 h-8 text-emerald-400" />
            </div>

            <div>
              <h3 className="font-display font-bold text-xl text-white">Admin Authentication Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter Master Password to access staff credentials and roster controls.
              </p>
            </div>

            <form onSubmit={handleAuthenticate} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admin Password or Recovery Key
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Default: admin123"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authError && (
                  <p className="text-xs text-rose-400 mt-1.5 font-medium">{authError}</p>
                )}
              </div>

              <button
                type="submit"
                id="btn-admin-login"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/80 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Control Center</span>
              </button>

              <div className="pt-2 p-3 bg-slate-900/60 rounded-xl border border-white/5 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Quick Reference Credentials:</div>
                <div>• Default Master Password: <code className="text-emerald-400 font-mono font-bold">admin123</code></div>
                <div>• Emergency Master Recovery Key: <code className="text-cyan-400 font-mono font-bold">{MASTER_RECOVERY_KEY}</code></div>
              </div>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="flex-1 flex flex-col overflow-hidden pt-3">
            {/* Nav Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto shrink-0">
              <button
                id="admin-tab-rosters"
                onClick={() => setCurrentTab('ROSTERS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  currentTab === 'ROSTERS'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>📁 1. Roster Folders & Shift Setup</span>
              </button>

              <button
                id="admin-tab-staff"
                onClick={() => setCurrentTab('STAFF')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  currentTab === 'STAFF'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>👥 2. Staff Ingestion & Registry</span>
                {currentActiveRoster && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {currentActiveRoster.members?.length || 0}
                  </span>
                )}
              </button>

              <button
                id="admin-tab-logs"
                onClick={() => setCurrentTab('LOGS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  currentTab === 'LOGS'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>📋 3. Attendance Audit Logs</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                  {logs.length}
                </span>
              </button>

              <button
                id="admin-tab-system"
                onClick={() => setCurrentTab('SYSTEM')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  currentTab === 'SYSTEM'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>⚙️ 4. Security & System Settings</span>
              </button>
            </div>

            {/* TAB CONTENT (Scrollable body) */}
            <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-6">
              {/* ======================================================== */}
              {/* TAB 1: ROSTERS & SCHEDULES */}
              {/* ======================================================== */}
              {currentTab === 'ROSTERS' && (
                <div className="space-y-6">
                  {/* Create New Roster Form */}
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-display font-bold text-base text-white">
                        Create New Roster Folder / Department
                      </h3>
                    </div>

                    <form onSubmit={handleCreateRoster} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Folder / Department Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 🏦 St. Jude — Emergency Ward ICU"
                          value={newRosterName}
                          onChange={(e) => setNewRosterName(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Shift Start Time
                        </label>
                        <input
                          type="time"
                          value={newShiftStart}
                          onChange={(e) => setNewShiftStart(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Shift End Time
                        </label>
                        <input
                          type="time"
                          value={newShiftEnd}
                          onChange={(e) => setNewShiftEnd(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Lateness Grace Period
                        </label>
                        <select
                          value={newGraceMin}
                          onChange={(e) => setNewGraceMin(Number(e.target.value))}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-xs focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value={0}>0 Minutes (Zero Grace)</option>
                          <option value={5}>5 Minutes</option>
                          <option value={10}>10 Minutes</option>
                          <option value={15}>15 Minutes</option>
                          <option value={30}>30 Minutes</option>
                          <option value={45}>45 Minutes</option>
                          <option value={60}>60 Minutes</option>
                        </select>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Custom Property Title (e.g. Vault Counter No, Lab Table, Station)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Station ID or Bed Number"
                          value={newCustomCol}
                          onChange={(e) => setNewCustomCol(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="submit"
                          id="btn-create-roster"
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Roster Folder</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Existing Rosters Table */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Existing Roster Folders ({rosters.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rosters.map((roster) => {
                        const isCurrentActive = roster.id === activeRosterId;
                        return (
                          <div
                            key={roster.id}
                            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                              isCurrentActive
                                ? 'bg-emerald-950/20 border-emerald-500/50'
                                : 'bg-slate-900/50 border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-display font-bold text-sm text-white">
                                  {roster.name}
                                </h5>
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>
                                    {formatShiftDisplay(roster.shiftStart)} - {formatShiftDisplay(roster.shiftEnd)}
                                  </span>
                                  <span>•</span>
                                  <span className="text-amber-300 font-medium">{roster.graceMin}m grace</span>
                                </div>
                              </div>
                              <button
                                id={`btn-delete-roster-${roster.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteRoster(roster.id, roster.name, roster.members?.length || 0);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Delete this roster folder"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                              <span className="text-slate-400">
                                Staff: <strong className="text-slate-200">{roster.members?.length || 0}</strong>
                              </span>
                              {!isCurrentActive ? (
                                <button
                                  onClick={() => {
                                    onSelectRoster(roster.id);
                                    onToast('info', 'Switched Active Roster', `Now managing ${roster.name}`);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
                                >
                                  Make Active
                                </button>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                                  Active Board
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: STAFF INGESTION & REGISTRY */}
              {/* ======================================================== */}
              {currentTab === 'STAFF' && (
                <div className="space-y-6">
                  {rosters.length === 0 ? (
                    <div className="text-center py-16 px-4 glass-panel rounded-2xl border border-white/5 space-y-4">
                      <FolderPlus className="w-12 h-12 text-slate-500 mx-auto" />
                      <h4 className="text-base font-bold text-slate-200">No Roster Folders Available</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Please create a department schedule in Tab 1 first before enrolling staff members.
                      </p>
                      <button
                        onClick={() => setCurrentTab('ROSTERS')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                      >
                        Go to 📁 1. Roster Folders & Shift Setup
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Current Active Roster Target banner */}
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">Target Folder for Personnel:</span>{' '}
                          <strong className="text-white text-sm ml-1 font-display">
                            {currentActiveRoster?.name}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Switch target:</span>
                          <select
                            value={currentActiveRoster?.id}
                            onChange={(e) => onSelectRoster(Number(e.target.value))}
                            className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                          >
                            {rosters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                  {/* DEDICATED SINGLE STAFF REGISTRATION FORM */}
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm text-white">
                          Single Staff Registration & Photo Enrollment
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Register staff with assigned 4-digit PIN and optional compressed profile avatar.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleRegisterStaff} className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Full Name <span className="text-rose-400">*</span>
                          </label>
                          <input
                            id="staffFullNameInput"
                            type="text"
                            placeholder="e.g. Elena Vance"
                            value={singleName}
                            onChange={(e) => setSingleName(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            4-Digit Device PIN <span className="text-rose-400">*</span>
                          </label>
                          <input
                            id="staffPinInput"
                            type="password"
                            maxLength={4}
                            placeholder="e.g. 1234"
                            value={singlePin}
                            onChange={(e) => setSinglePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            required
                            className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-white/10 text-white font-mono text-xs tracking-widest placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {currentActiveRoster?.customColName || 'Custom Property Value'}
                          </label>
                          <input
                            id="staffCustomValInput"
                            type="text"
                            placeholder="e.g. Vault Counter 1 or Lab Desk"
                            value={singleCustom}
                            onChange={(e) => setSingleCustom(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>

                      {/* Profile Photo Upload with Instant Circular Preview */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {singlePhotoBase64 ? (
                            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-400 shadow-md shrink-0">
                              <img
                                src={singlePhotoBase64}
                                alt="Profile preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                              <Camera className="w-6 h-6" />
                            </div>
                          )}

                          <div>
                            <span className="block text-xs font-semibold text-white">
                              Profile Photo Avatar
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Resized & compressed to ~150x150 JPEG for lightweight offline storage (~8KB).
                            </span>
                            {isCompressingPhoto && (
                              <p className="text-[10px] text-emerald-400 font-medium mt-0.5 animate-pulse">
                                Compressing image canvas...
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            ref={singlePhotoInputRef}
                            type="file"
                            accept="image/*"
                            id="staffPhotoInput"
                            onChange={handlePhotoSelected}
                            className="text-[11px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-600/30 file:text-emerald-300 hover:file:bg-emerald-600/50 cursor-pointer"
                          />

                          {singlePhotoBase64 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSinglePhotoBase64('');
                                if (singlePhotoInputRef.current) singlePhotoInputRef.current.value = '';
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          id="btn-register-staff-submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>➕ Register & Add Staff</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* MEMBER REGISTRY TABLE */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Registered Staff in "{currentActiveRoster?.name}" ({currentActiveRoster?.members?.length || 0})
                      </h4>
                    </div>

                    {currentActiveRoster?.members?.length === 0 ? (
                      <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-white/5 text-slate-400 text-xs">
                        No personnel enrolled in this folder yet. Use the registration form above to enroll staff.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/80">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider text-[11px] font-bold border-b border-white/10">
                            <tr>
                              <th className="p-3 w-12 text-center">Photo</th>
                              <th className="p-3">Staff Name</th>
                              <th className="p-3">Assigned 4-Digit PIN</th>
                              <th className="p-3">
                                {currentActiveRoster?.customColName || 'Custom Property'}
                              </th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                            {currentActiveRoster?.members?.map((member) => {
                              const isRevealed = !!revealedPins[member.id];
                              const isEditing = editingMember?.id === member.id;
                              const initials = member.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase();

                              if (isEditing) {
                                return (
                                  <tr key={member.id} className="bg-slate-800/80">
                                    <td className="p-2 text-center">
                                      {member.profilePhotoBase64 ? (
                                        <img
                                          src={member.profilePhotoBase64}
                                          alt={member.name}
                                          className="w-8 h-8 rounded-full object-cover border border-emerald-500/40 inline-block"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 font-bold text-[10px] inline-flex items-center justify-center border border-white/10">
                                          {initials}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5">
                                      <input
                                        type="text"
                                        value={editingMember.name}
                                        onChange={(e) =>
                                          setEditingMember({ ...editingMember, name: e.target.value })
                                        }
                                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                                      />
                                    </td>
                                    <td className="p-2.5">
                                      <input
                                        type="text"
                                        maxLength={4}
                                        value={editingMember.pin}
                                        onChange={(e) =>
                                          setEditingMember({
                                            ...editingMember,
                                            pin: e.target.value.replace(/\D/g, '').slice(0, 4),
                                          })
                                        }
                                        className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded font-mono text-xs text-white"
                                      />
                                    </td>
                                    <td className="p-2.5">
                                      <input
                                        type="text"
                                        value={editingMember.customVal}
                                        onChange={(e) =>
                                          setEditingMember({ ...editingMember, customVal: e.target.value })
                                        }
                                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                                      />
                                    </td>
                                    <td className="p-2.5 text-right space-x-2">
                                      <button
                                        onClick={handleSaveEditMember}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold text-xs cursor-pointer"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingMember(null)}
                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={member.id} className="hover:bg-slate-800/50">
                                  <td className="p-2 text-center">
                                    {member.profilePhotoBase64 ? (
                                      <img
                                        src={member.profilePhotoBase64}
                                        alt={member.name}
                                        className="w-8 h-8 rounded-full object-cover border border-emerald-500/40 inline-block shadow-sm"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-bold text-[10px] inline-flex items-center justify-center border border-white/10">
                                        {initials}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 font-semibold text-white">{member.name}</td>
                                  <td className="p-3 font-mono">
                                    <div className="flex items-center gap-2">
                                      <span className="tracking-widest font-bold">
                                        {isRevealed ? member.pin : '••••'}
                                      </span>
                                      <button
                                        onClick={() => togglePinReveal(member.id)}
                                        className="text-slate-400 hover:text-white cursor-pointer"
                                        title={isRevealed ? 'Hide PIN' : 'Reveal PIN'}
                                      >
                                        {isRevealed ? (
                                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                        ) : (
                                          <Eye className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-3 text-slate-400">{member.customVal || '—'}</td>
                                  <td className="p-3 text-right space-x-2">
                                    <button
                                      onClick={() => setEditingMember({ ...member })}
                                      className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer"
                                      title="Edit Member"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMember(member.id)}
                                      className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                                      title="Delete Member"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 3: ATTENDANCE AUDIT LOGS & EXPORT */}
              {/* ======================================================== */}
              {currentTab === 'LOGS' && (
                <div className="space-y-4">
                  {/* Top Bar for Logs: Download CSV & Clear Logs */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/70 border border-white/10">
                    <div>
                      <h4 className="font-display font-bold text-sm text-white">
                        Attendance Audit Trail & Verification Logs ({logs.length} Records)
                      </h4>
                      <p className="text-xs text-slate-400">
                        View historical check-in records and download Excel/CSV reports
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
                      <button
                        onClick={() => exportAttendanceLogsToCsv(logs)}
                        id="btn-download-csv"
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/60 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Attendance Sheet (.CSV)</span>
                      </button>

                      <button
                        onClick={() => setShowClearConfirm(true)}
                        id="btn-clear-logs"
                        className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Clear Logs</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search logs by staff name..."
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <select
                        value={logRosterFilter}
                        onChange={(e) => setLogRosterFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                      >
                        <option value="ALL">All Rosters</option>
                        {rosters.map((r) => (
                          <option key={r.id} value={String(r.id)}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={logStatusFilter}
                        onChange={(e) => setLogStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ON_TIME">🟢 ON_TIME</option>
                        <option value="LATE">🟡 LATE</option>
                        <option value="EARLY">🔵 EARLY</option>
                      </select>
                    </div>
                  </div>

                  {/* Logs Table */}
                  {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center bg-slate-900/40 rounded-xl border border-white/5 text-slate-400 text-xs">
                      No attendance logs found matching filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/80 max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider text-[10px] font-bold border-b border-white/10 sticky top-0">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Verified Time</th>
                            <th className="p-2.5 text-center">Photo Proof</th>
                            <th className="p-2.5">Staff Name</th>
                            <th className="p-2.5">Roster Folder</th>
                            <th className="p-2.5">Property</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Method</th>
                            <th className="p-2.5 text-right">Audit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {filteredLogs.map((log) => (
                            <tr
                              key={log.id}
                              className="hover:bg-slate-800/60 font-mono text-[11px] cursor-pointer transition-colors"
                              onClick={() => setSelectedAuditLog(log)}
                            >
                              <td className="p-2.5 text-slate-400 font-sans">{log.date}</td>
                              <td className="p-2.5 text-emerald-300 font-bold">{log.time}</td>
                              <td
                                className="p-2.5 text-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAuditLog(log);
                                }}
                              >
                                {log.liveSnapshotBase64 ? (
                                  <div className="relative inline-block group">
                                    <img
                                      src={log.liveSnapshotBase64}
                                      alt="Proof"
                                      className="w-8 h-8 rounded-lg object-cover border border-emerald-500/50 group-hover:border-emerald-400 group-hover:scale-110 transition-all shadow-sm mx-auto"
                                    />
                                    <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 inline-flex items-center justify-center text-slate-500 mx-auto">
                                    <Camera className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 font-sans font-semibold text-white">
                                <div className="flex items-center gap-1.5">
                                  <span>{log.name}</span>
                                  {log.liveSnapshotBase64 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      Photo verified
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-slate-400 font-sans">{log.rosterName}</td>
                              <td className="p-2.5 text-slate-400 font-sans">{log.customVal || '—'}</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                                    log.status === 'ON_TIME'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : log.status === 'EARLY'
                                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-500 text-[10px] font-sans">
                                {log.verifiedMethod}
                              </td>
                              <td className="p-2.5 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAuditLog(log);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 4: SECURITY & SYSTEM SETTINGS */}
              {/* ======================================================== */}
              {currentTab === 'SYSTEM' && (
                <div className="space-y-6">
                  {/* Optional Sample Demo Suite Loader */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-slate-900 to-emerald-950/30 border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                        <h4 className="font-display font-bold text-sm text-white">
                          Sample Demo Rosters (Optional Manual Loader)
                        </h4>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-medium">
                        Optional Action
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Need instant realistic schedules for testing or demonstration? Tap below to manually load three pre-configured organizational rosters:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs text-slate-300">
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                        <strong className="text-white block">🏦 First Bank</strong>
                        Bulk Cash Vault (07:30 - 16:00, 5m Grace, Vault Counter No)
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                        <strong className="text-white block">🏫 FUMMSA Lab</strong>
                        Anatomy Dissection (08:00 - 16:00, 15m Grace, Table No)
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                        <strong className="text-white block">🏢 Corporate IT & SOC</strong>
                        Security Ops (08:30 - 17:30, 10m Grace, Station No)
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => {
                          onLoadDemos();
                          onToast('success', 'Sample Demos Loaded', 'Sample rosters for Bank, University, and IT have been populated.');
                        }}
                        id="btn-admin-load-demos"
                        className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 transition-all active:scale-95 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Load Sample Demo Rosters</span>
                      </button>

                      {rosters.length > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm('Reset application to 100% clean, empty state? All current rosters will be cleared.')) {
                              onSaveRosters([]);
                              onToast('info', 'Pristine State Restored', 'All rosters cleared. Empty state active.');
                            }
                          }}
                          id="btn-admin-clear-rosters"
                          className="px-4 py-2.5 bg-slate-800 hover:bg-rose-950/60 border border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" />
                          <span>Reset to Clean Empty State</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Export Standalone HTML file */}
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-emerald-400" />
                      <h4 className="font-display font-bold text-sm text-white">
                        Portable Single-File Kiosk Export (.HTML)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Generate and download an entirely self-contained HTML file with embedded styles and JavaScript.
                      Can be run directly off a USB drive or kiosk browser without any web server or Internet access.
                    </p>
                    <button
                      onClick={downloadStandaloneHtmlFile}
                      id="btn-export-standalone-admin"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/15 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Download OmniRoster_Universal_Offline_Kiosk.html</span>
                    </button>
                  </div>

                  {/* Password & Security Configuration */}
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-400" />
                      <h4 className="font-display font-bold text-sm text-white">
                        Change Master Admin Password
                      </h4>
                    </div>

                    <form onSubmit={handleChangeAdminPassword} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">New Password</label>
                        <input
                          type="password"
                          placeholder="Min 4 characters"
                          value={newAdminPwd}
                          onChange={(e) => setNewAdminPwd(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          placeholder="Confirm"
                          value={confirmAdminPwd}
                          onChange={(e) => setConfirmAdminPwd(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          Update Master Password
                        </button>
                      </div>
                    </form>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-[11px] text-slate-400 space-y-1">
                      <div>Emergency Hardcoded Recovery Key: <strong className="text-cyan-300 font-mono">{MASTER_RECOVERY_KEY}</strong></div>
                      <div>Storage Location: Browser LocalStorage (`omni_admin_password_v2`)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal for Clearing Logs */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
            <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
              <h3 className="font-display font-bold text-lg text-white">Clear All Attendance Logs?</h3>
              <p className="text-xs text-slate-400">
                This action will wipe all historical attendance records from localStorage. This cannot be undone.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClearLogs();
                    setShowClearConfirm(false);
                    onToast('info', 'Logs Cleared', 'Historical attendance logs have been wiped.');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 cursor-pointer"
                >
                  Confirm Wipe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Deleting Roster Folder */}
        {rosterToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-slate-900/95 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display font-bold text-lg text-white">
                  Permanently Delete Roster?
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-rose-300">"{rosterToDelete.name}"</strong>?
                  {rosterToDelete.memberCount > 0 && (
                    <span className="block mt-1 text-slate-400 text-[11px]">
                      This will remove all {rosterToDelete.memberCount} scheduled staff member(s) from this folder.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  id="btn-cancel-delete-roster"
                  onClick={() => setRosterToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-delete-roster"
                  onClick={executeDeleteRoster}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 cursor-pointer transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Identity Audit: Side-by-Side Photo Comparison Modal */}
        {selectedAuditLog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-slate-900/95 border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5 relative">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-white">
                      Identity & Anti-Proxy Attendance Audit
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Facial verification inspection for verification #{selectedAuditLog.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAuditLog(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Side-by-side Dual Image Matrix */}
              <div className="grid grid-cols-2 gap-4">
                {/* 1. Official Registered Profile Photo */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col items-center text-center space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    1. Registered Official Photo
                  </span>
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-inner">
                    {selectedAuditLog.registeredPhotoBase64 ? (
                      <img
                        src={selectedAuditLog.registeredPhotoBase64}
                        alt="Registered Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-[11px] flex flex-col items-center">
                        <Users className="w-8 h-8 mb-1.5 text-slate-600" />
                        <span>No photo enrolled at registration</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Admin Staff Registry Record
                  </span>
                </div>

                {/* 2. Live Kiosk Camera Snapshot */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex flex-col items-center text-center space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>2. Live Kiosk Snapshot</span>
                  </div>
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-500/50 flex items-center justify-center shadow-inner">
                    {selectedAuditLog.liveSnapshotBase64 ? (
                      <img
                        src={selectedAuditLog.liveSnapshotBase64}
                        alt="Live Kiosk Snapshot"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-[11px] flex flex-col items-center">
                        <Camera className="w-8 h-8 mb-1.5 text-slate-600" />
                        <span>No live camera frame recorded</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Captured on PIN Entry
                  </span>
                </div>
              </div>

              {/* Log Metadata Details */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Staff Name</span>
                    <strong className="text-white font-semibold text-sm">{selectedAuditLog.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Department</span>
                    <span className="text-cyan-300 font-semibold">{selectedAuditLog.rosterName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Verified Timestamp</span>
                    <span className="text-white font-mono">{selectedAuditLog.date} {selectedAuditLog.time}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Punctuality</span>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedAuditLog.status === 'ON_TIME'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : selectedAuditLog.status === 'EARLY'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {selectedAuditLog.status}
                    </span>
                  </div>
                </div>

                {selectedAuditLog.shiftWindow && (
                  <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Assigned Shift Window:</span>
                    <span className="font-mono text-slate-200 font-medium">{selectedAuditLog.shiftWindow}</span>
                  </div>
                )}
                {selectedAuditLog.customVal && (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Assigned Custom Property:</span>
                    <span className="text-slate-200 font-medium">{selectedAuditLog.customVal}</span>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setSelectedAuditLog(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Audit Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
