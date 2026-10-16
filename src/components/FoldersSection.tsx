import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit3,
  Users,
  Clock,
  CheckSquare,
  Square,
  AlertCircle,
  X,
  RotateCw,
  Folder as FolderIcon,
  Check,
  Calendar,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldAlert,
  Search,
} from 'lucide-react';
import type { Folder, Employee, FolderType } from '../utils/db';
import {
  generateOptimizedRoster,
  DEFAULT_SHIFT_DEFINITIONS,
  type ShiftDefinition,
  type GeneratedShift,
  type RosterOptimizationResult,
} from '../utils/rosterAlgorithm';

interface FoldersSectionProps {
  onRefreshStats?: () => void;
}

export const FoldersSection: React.FC<FoldersSectionProps> = ({ onRefreshStats }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Common Fields
  const [folderName, setFolderName] = useState('');
  const [folderType, setFolderType] = useState<FolderType>('simple_shift');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Simple Shift Fields
  const [startTime, setStartTime] = useState('09:00');
  const [gracePeriod, setGracePeriod] = useState(15);

  // Optimized Roster Fields
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysCount, setDaysCount] = useState(7);
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState(5);
  const [maxShiftsPerStaff, setMaxShiftsPerStaff] = useState(5);
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>(DEFAULT_SHIFT_DEFINITIONS);
  const [rosterResult, setRosterResult] = useState<RosterOptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  // Schedule Viewer Modal
  const [viewingScheduleFolder, setViewingScheduleFolder] = useState<Folder | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [foldersRes, empsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/employees'),
      ]);

      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }
      if (empsRes.ok) {
        const data = await empsRes.json();
        setEmployees(data.employees || []);
      }

      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('[FoldersSection] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingFolderId(null);
    setFolderName('');
    setFolderType('simple_shift');
    setStartTime('09:00');
    setGracePeriod(15);
    setStartDate(new Date().toISOString().split('T')[0]);
    setDaysCount(7);
    setMaxConsecutiveDays(5);
    setMaxShiftsPerStaff(5);
    setShiftDefs(DEFAULT_SHIFT_DEFINITIONS);
    setSelectedEmpIds([]);
    setRosterResult(null);
    setModalError(null);
    setShowModal(true);
  };

  const openEditModal = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setFolderType(folder.type || 'simple_shift');
    setStartTime(folder.startTime || '09:00');
    setGracePeriod(folder.gracePeriodMinutes || 15);
    setSelectedEmpIds(folder.assignedEmployeeIds || []);

    if (folder.rosterConfig) {
      setStartDate(folder.rosterConfig.startDate || new Date().toISOString().split('T')[0]);
      setDaysCount(folder.rosterConfig.daysCount || 7);
      setMaxConsecutiveDays(folder.rosterConfig.maxConsecutiveDays || 5);
      setMaxShiftsPerStaff(folder.rosterConfig.maxShiftsPerStaff || 5);
      setShiftDefs(folder.rosterConfig.shiftDefinitions || DEFAULT_SHIFT_DEFINITIONS);
    }

    if (folder.generatedShifts) {
      setRosterResult({
        shifts: folder.generatedShifts,
        unassignedShifts: 0,
        coveragePercent: 100,
        violationsCount: 0,
        employeeWorkload: {},
      });
    } else {
      setRosterResult(null);
    }

    setModalError(null);
    setShowModal(true);
  };

  const toggleEmployeeSelection = (empId: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(employees.map((e) => e.id));
    }
  };

  // Run CSP Optimization algorithm for Roster
  const handleRunCSPOptimization = () => {
    setOptimizing(true);
    setModalError(null);

    try {
      const candidates = employees.filter((e) =>
        selectedEmpIds.length > 0 ? selectedEmpIds.includes(e.id) : true
      );

      if (candidates.length === 0) {
        setModalError('Please select at least 1 staff member for the roster pool.');
        setOptimizing(false);
        return;
      }

      const result = generateOptimizedRoster(candidates, {
        startDate,
        daysCount: Number(daysCount) || 7,
        shiftDefinitions: shiftDefs,
        maxConsecutiveDays: Number(maxConsecutiveDays) || 5,
        maxShiftsPerStaff: Number(maxShiftsPerStaff) || 5,
        minRestHoursBetweenShifts: 8,
      });

      setRosterResult(result);
    } catch (err: any) {
      setModalError(err.message || 'CSP Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!folderName.trim()) {
      setModalError('Folder name is required.');
      return;
    }

    if (folderType === 'simple_shift' && !startTime) {
      setModalError('Shift start time is required.');
      return;
    }

    // Auto-generate roster if none generated yet
    let finalShifts = rosterResult?.shifts;
    if (folderType === 'optimized_roster' && (!finalShifts || finalShifts.length === 0)) {
      const candidates = employees.filter((e) =>
        selectedEmpIds.length > 0 ? selectedEmpIds.includes(e.id) : true
      );
      if (candidates.length === 0) {
        setModalError('Please assign staff members to generate the roster schedule.');
        return;
      }
      const res = generateOptimizedRoster(candidates, {
        startDate,
        daysCount: Number(daysCount) || 7,
        shiftDefinitions: shiftDefs,
        maxConsecutiveDays: Number(maxConsecutiveDays) || 5,
        maxShiftsPerStaff: Number(maxShiftsPerStaff) || 5,
      });
      finalShifts = res.shifts;
    }

    setSaving(true);
    try {
      const payload: Partial<Folder> = {
        name: folderName.trim(),
        type: folderType,
        startTime: folderType === 'simple_shift' ? startTime : (shiftDefs[0]?.startTime || '08:00'),
        gracePeriodMinutes: folderType === 'simple_shift' ? Number(gracePeriod) : (shiftDefs[0]?.gracePeriodMinutes || 15),
        assignedEmployeeIds: selectedEmpIds,
        rosterConfig: folderType === 'optimized_roster' ? {
          startDate,
          daysCount: Number(daysCount),
          shiftDefinitions: shiftDefs,
          maxConsecutiveDays: Number(maxConsecutiveDays),
          maxShiftsPerStaff: Number(maxShiftsPerStaff),
        } : undefined,
        generatedShifts: folderType === 'optimized_roster' ? finalShifts : undefined,
      };

      if (editingFolderId) {
        const res = await fetch(`/api/folders/${editingFolderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update folder');
        }
      } else {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create folder');
        }
      }

      setShowModal(false);
      await fetchData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Error saving folder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (folderId: string, folderTitle: string) => {
    if (!confirm(`Are you sure you want to delete folder "${folderTitle}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('[FoldersSection] Delete error:', err);
    }
  };

  const filteredFolders = folders.filter((f) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return f.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            Shift & Roster Folders ({folders.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create "Simple Shifts" (fixed time) or "Optimized Rosters" (automated CSP multi-shift schedules)
          </p>
        </div>

        {/* Top Right Controls: Search bar next to Create Folder button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Folder</span>
          </button>
        </div>
      </div>

      {/* Folders Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center">
          <RotateCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
          <span>Loading shift folders...</span>
        </div>
      ) : folders.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <FolderIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Folders Created Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Create a "Simple Shift" or an "Optimized Roster" to begin managing attendance.
          </p>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Create Folder
          </button>
        </div>
      ) : filteredFolders.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <FolderIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Folders Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No folders match "{search}". Try searching with a different name.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFolders.map((folder) => {
            const memberCount = folder.assignedEmployeeIds?.length || 0;
            const isRoster = folder.type === 'optimized_roster';
            const shiftsCount = folder.generatedShifts?.length || 0;

            return (
              <div
                key={folder.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      isRoster
                        ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        : 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}>
                      {isRoster ? <Sparkles className="w-3 h-3 text-purple-500" /> : <FolderIcon className="w-3 h-3 text-blue-500" />}
                      {isRoster ? 'Optimized Roster' : 'Simple Shift'}
                    </span>

                    <div className="flex items-center gap-1">
                      {isRoster && (
                        <button
                          onClick={() => setViewingScheduleFolder(folder)}
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors cursor-pointer"
                          title="View Generated Roster Schedule"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(folder)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        title="Edit Folder"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(folder.id, folder.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-3">
                    {folder.name}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80">
                    {isRoster ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-purple-500" />
                            Horizon / Duration:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {folder.rosterConfig?.daysCount || 7} Days
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Layers className="w-3.5 h-3.5 text-purple-500" />
                            Generated Shifts:
                          </span>
                          <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                            {shiftsCount} shifts
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Shift Start Time:
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {folder.startTime}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            Grace Period:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            ±{folder.gracePeriodMinutes} mins
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        Assigned Pool:
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {memberCount} staff
                      </span>
                    </div>
                  </div>
                </div>

                {isRoster && (
                  <button
                    onClick={() => setViewingScheduleFolder(folder)}
                    className="mt-3 w-full py-1.5 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center justify-center gap-1 border border-purple-200 dark:border-purple-800/80 cursor-pointer transition-colors"
                  >
                    <span>View CSP Schedule Grid</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-blue-600" />
                  {editingFolderId ? 'Edit Shift Folder' : 'Create New Shift Folder'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select folder mode: Simple Shift or Automated CSP Roster
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
              {/* Folder Type Radio Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Folder Scheduling Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFolderType('simple_shift')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      folderType === 'simple_shift'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        1. Simple Shift
                      </span>
                      {folderType === 'simple_shift' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Single fixed start time + grace period (e.g. 9-5).
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFolderType('optimized_roster')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      folderType === 'optimized_roster'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-900 dark:text-purple-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        2. Optimized Roster (CSP)
                      </span>
                      {folderType === 'optimized_roster' && <Check className="w-4 h-4 text-purple-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auto-generates multi-shift schedules with CSP constraints.
                    </span>
                  </button>
                </div>
              </div>

              {/* Folder Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder={folderType === 'simple_shift' ? 'e.g. Morning Shift - Security' : 'e.g. 24/7 Ward Roster - ER'}
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* SIMPLE SHIFT CONFIG */}
              {folderType === 'simple_shift' ? (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Grace Period (± Minutes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={gracePeriod}
                      onChange={(e) => setGracePeriod(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                /* OPTIMIZED ROSTER CONFIG */
                <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      CSP Constraint Rules
                    </span>
                    <button
                      type="button"
                      onClick={handleRunCSPOptimization}
                      disabled={optimizing}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${optimizing ? 'animate-spin' : ''}`} />
                      <span>{rosterResult ? 'Re-Run Optimization' : 'Run CSP Solver'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Horizon (Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={daysCount}
                        onChange={(e) => setDaysCount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Max Consecutive
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={maxConsecutiveDays}
                        onChange={(e) => setMaxConsecutiveDays(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Max Shifts/Staff
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={maxShiftsPerStaff}
                        onChange={(e) => setMaxShiftsPerStaff(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* CSP Output Metrics Badge */}
                  {rosterResult && (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-200 dark:border-purple-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {rosterResult.coveragePercent}% Coverage
                        </span>
                        <span className="text-slate-500">
                          {rosterResult.shifts.length} Total Shifts Generated
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                        Rest Period Enforced
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Staff Pool Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Assign Staff Pool ({selectedEmpIds.length} of {employees.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                  >
                    {selectedEmpIds.length === employees.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 p-1">
                  {employees.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">
                      No employees enrolled yet. Add employees first in Members tab.
                    </p>
                  ) : (
                    employees.map((emp) => {
                      const isSelected = selectedEmpIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleEmployeeSelection(emp.id)}
                          className="flex items-center justify-between p-2.5 hover:bg-white dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              <span className="text-xs font-medium text-slate-900 dark:text-white block">
                                {emp.fullName}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {emp.role} • {emp.department}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingFolderId ? 'Save Changes' : 'Create Folder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE VIEWER MODAL FOR ROSTERS */}
      {viewingScheduleFolder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {viewingScheduleFolder.name} - CSP Roster
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Auto-generated schedule assignments across days and shifts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingScheduleFolder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3">
              {(!viewingScheduleFolder.generatedShifts || viewingScheduleFolder.generatedShifts.length === 0) ? (
                <p className="p-8 text-center text-xs text-slate-400">
                  No shifts generated for this roster folder.
                </p>
              ) : (
                viewingScheduleFolder.generatedShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {shift.formattedDate}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                          {shift.type}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {shift.startTime} - {shift.endTime} (±{shift.gracePeriodMinutes}m grace)
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Assigned Staff
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {shift.staffAssigned && shift.staffAssigned.length > 0 ? (
                          shift.staffAssigned.map((id) => {
                            const emp = employees.find((e) => e.id === id);
                            return (
                              <span
                                key={id}
                                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded text-[11px] font-medium"
                              >
                                {emp?.fullName || id}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-rose-500 font-semibold text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingScheduleFolder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
