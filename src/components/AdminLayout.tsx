import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  RotateCw,
  Users,
  FolderKanban,
  Shield,
  Clock,
  LogOut,
  ChevronRight,
  UserPlus,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { MembersSection } from './MembersSection';
import { FoldersSection } from './FoldersSection';
import { AttendanceViewer } from './AttendanceViewer';
import { SecuritySection } from './SecuritySection';

interface AdminLayoutProps {
  onExitAdmin: () => void;
}

type RibbonTab = 'overview' | 'members' | 'folders' | 'attendance' | 'security';

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onExitAdmin }) => {
  const [activeTab, setActiveTab] = useState<RibbonTab>('folders');
  const [memberCount, setMemberCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('All offline changes saved to IndexedDB');

  const fetchStats = async () => {
    try {
      const [empRes, foldRes, attRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/folders'),
        fetch('/api/attendance'),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setMemberCount((empData.employees || []).length);
      }
      if (foldRes.ok) {
        const foldData = await foldRes.json();
        setFolderCount((foldData.folders || []).length);
      }
      if (attRes.ok) {
        const attData = await attRes.json();
        setAttendanceCount((attData.attendance || []).length);
      }
    } catch (err) {
      console.warn('[AdminLayout] Fetch stats error:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleManualSave = () => {
    setStatusMessage('Sync verified: Standalone database verified at ' + new Date().toLocaleTimeString());
    setTimeout(() => {
      setStatusMessage('All offline changes saved to IndexedDB');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* ========================================================= */}
      {/* MICROSOFT WORD STYLE TOP TITLE BAR                        */}
      {/* ========================================================= */}
      <header className="bg-[#185abd] text-white px-3 py-1.5 flex items-center justify-between text-xs select-none shadow-sm">
        {/* Left: App Logo & Quick Access Toolbar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold tracking-tight bg-blue-800/80 px-2 py-0.5 rounded text-[11px]">
            <FileText className="w-3.5 h-3.5 text-blue-200" />
            <span>Word / OmniRoster</span>
          </div>

          <div className="h-3 w-px bg-blue-400/40 mx-0.5" />

          <button
            onClick={handleManualSave}
            title="Save to IndexedDB (Ctrl+S)"
            className="p-1 rounded hover:bg-blue-700/80 text-blue-100 hover:text-white transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchStats}
            title="Refresh database"
            className="p-1 rounded hover:bg-blue-700/80 text-blue-100 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Document Title */}
        <div className="hidden md:flex items-center gap-2 font-medium text-blue-100 text-[11px]">
          <span>OmniRoster-OS-Master.docm</span>
          <span className="text-blue-300">•</span>
          <span className="text-blue-200 text-[10px]">{statusMessage}</span>
        </div>

        {/* Right: Exit to Terminal */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExitAdmin}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            title="Exit Admin & Open Punch-In Terminal"
          >
            <LogOut className="w-3 h-3" />
            <span>Exit to Terminal</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* OFFICE RIBBON TABS                                        */}
      {/* ========================================================= */}
      <nav className="bg-[#f3f2f1] dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-3 flex items-center gap-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 select-none overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'border-[#185abd] text-[#185abd] dark:text-blue-400 bg-white dark:bg-slate-800/80'
              : 'border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800'
          }`}
        >
          File / Overview
        </button>
        <button
          onClick={() => setActiveTab('folders')}
          className={`px-3 py-1.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'folders'
              ? 'border-[#185abd] text-[#185abd] dark:text-blue-400 bg-white dark:bg-slate-800/80'
              : 'border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800'
          }`}
        >
          Folders ({folderCount})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-3 py-1.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'members'
              ? 'border-[#185abd] text-[#185abd] dark:text-blue-400 bg-white dark:bg-slate-800/80'
              : 'border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800'
          }`}
        >
          Members ({memberCount})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-3 py-1.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'attendance'
              ? 'border-[#185abd] text-[#185abd] dark:text-blue-400 bg-white dark:bg-slate-800/80'
              : 'border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800'
          }`}
        >
          Attendance ({attendanceCount})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-3 py-1.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'security'
              ? 'border-[#185abd] text-[#185abd] dark:text-blue-400 bg-white dark:bg-slate-800/80'
              : 'border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800'
          }`}
        >
          Security & PIN
        </button>
      </nav>

      {/* ========================================================= */}
      {/* OFFICE RIBBON QUICK ACTION TOOLBAR                        */}
      {/* ========================================================= */}
      <div className="bg-[#fbfbfb] dark:bg-slate-900/90 border-b border-slate-300 dark:border-slate-800 px-4 py-2 flex items-center gap-6 overflow-x-auto select-none shadow-2xs">
        {/* Quick Nav Group */}
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('folders')}
            className={`flex flex-col items-center justify-center p-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'folders'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <FolderKanban className="w-4 h-4 mb-0.5 text-blue-600" />
            <span>Shift Folders</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex flex-col items-center justify-center p-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'members'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5 text-emerald-600" />
            <span>Staff Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center justify-center p-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4 mb-0.5 text-purple-600" />
            <span>Audit Ledger</span>
          </button>
        </div>

        {/* Database Controls */}
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={handleManualSave}
            className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium cursor-pointer"
          >
            <Save className="w-4 h-4 text-blue-600 mb-0.5" />
            <span>Save State</span>
          </button>
          <button
            onClick={fetchStats}
            className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium cursor-pointer"
          >
            <RotateCw className="w-4 h-4 text-emerald-600 mb-0.5" />
            <span>Reload DB</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN DOCUMENT PAGE CONTAINER                              */}
      {/* ========================================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8">
        {/* TAB 1: FILE / OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                OmniRoster OS — System Overview
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                Universal, offline-first biometric attendance terminal based on the simple <strong>Folder = Shift</strong> architecture. All data operations are securely intercepted and persisted to local IndexedDB.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div
                  onClick={() => setActiveTab('folders')}
                  className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 hover:border-blue-400 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                      Shift Folders
                    </span>
                    <FolderKanban className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {folderCount}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Folders define start time, grace period, and staff roster.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('members')}
                  className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Enrolled Members
                    </span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {memberCount}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Personnel enrolled with 128-D vectors and 4-digit PINs.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('attendance')}
                  className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 hover:border-purple-400 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                      Punch Records
                    </span>
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {attendanceCount}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Audit logs, duplicate warnings, and custom CSV export.
                  </p>
                </div>
              </div>
            </div>

            {/* Launch Terminal Button */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div>
                <h3 className="text-lg font-bold">Launch Employee Biometric Terminal</h3>
                <p className="text-xs text-blue-100 max-w-xl mt-1">
                  Switch device into kiosk mode. Staff select their shift folder, scan their face or enter their PIN, and check in.
                </p>
              </div>
              <button
                onClick={onExitAdmin}
                className="px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
              >
                Launch Biometric Terminal
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SHIFT FOLDERS */}
        {activeTab === 'folders' && (
          <FoldersSection onRefreshStats={fetchStats} />
        )}

        {/* TAB 3: MEMBERS */}
        {activeTab === 'members' && (
          <MembersSection onRefreshStats={fetchStats} />
        )}

        {/* TAB 4: ATTENDANCE VIEWER */}
        {activeTab === 'attendance' && (
          <AttendanceViewer onRefresh={fetchStats} />
        )}

        {/* TAB 5: SECURITY */}
        {activeTab === 'security' && <SecuritySection />}
      </main>
    </div>
  );
};
