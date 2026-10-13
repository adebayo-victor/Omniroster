import React, { useState, useEffect } from 'react';
import {
  Folder as FolderIcon,
  Clock,
  Users,
  Search,
  Lock,
  ArrowRight,
  ShieldCheck,
  WifiOff,
  RotateCw,
  Layers,
  ChevronRight,
  Sparkles,
  Calendar,
} from 'lucide-react';
import type { Folder } from '../utils/db';

interface EmployeeHomeProps {
  onSelectFolder: (folder: Folder) => void;
  onOpenAdmin: () => void;
}

export const EmployeeHome: React.FC<EmployeeHomeProps> = ({
  onSelectFolder,
  onOpenAdmin,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<'all' | 'simple_shift' | 'optimized_roster'>('all');

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error('[EmployeeHome] Error fetching folders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const todayIso = currentTime.toISOString().split('T')[0];

  const filteredFolders = folders.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === 'all'
        ? true
        : typeFilter === 'optimized_roster'
        ? f.type === 'optimized_roster'
        : f.type !== 'optimized_roster';
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Kiosk Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">OmniRoster OS</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 rounded-full">
                Biometric Station
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                100% Offline Standalone
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <WifiOff className="w-3 h-3" />
                Service Worker Loopback
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Clock & Admin Access */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="font-mono text-xl font-bold tracking-tight text-cyan-300">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Access Administrative Office Suite"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">Admin Management</span>
          </button>
        </div>
      </header>

      {/* Main Kiosk Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col">
        {/* Title Section */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Select Attendance Folder
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Tap your designated shift or roster folder below to activate the biometric scanner, verify arrival time, and confirm your attendance punch.
            </p>
          </div>

          <button
            onClick={fetchFolders}
            className="self-center sm:self-auto p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Shift Folders"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 sm:p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Folders ({folders.length})
            </button>
            <button
              onClick={() => setTypeFilter('simple_shift')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'simple_shift'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Simple Shifts
            </button>
            <button
              onClick={() => setTypeFilter('optimized_roster')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'optimized_roster'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-300" />
              <span>Optimized Rosters</span>
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search folders..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>
        </div>

        {/* Folders Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <RotateCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm">Loading attendance folders from local store...</p>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
            <Layers className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-bold text-slate-200 mb-1">No Folders Found</h3>
            <p className="text-sm text-slate-400 max-w-sm mb-4">
              {searchQuery
                ? `No shift folders matching "${searchQuery}".`
                : 'No folders match the selected filter.'}
            </p>
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Open Admin to Create Folder
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredFolders.map((folder) => {
              const memberCount = folder.assignedEmployeeIds?.length || 0;
              const isRoster = folder.type === 'optimized_roster';
              const todayShift = isRoster && folder.generatedShifts
                ? folder.generatedShifts.find((s) => s.dateStr === todayIso)
                : null;

              return (
                <div
                  key={folder.id}
                  onClick={() => onSelectFolder(folder)}
                  className={`group relative bg-slate-900/70 hover:bg-slate-900 border rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between ${
                    isRoster
                      ? 'border-purple-800/60 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10'
                      : 'border-slate-800/90 hover:border-cyan-500/60 hover:shadow-xl hover:shadow-cyan-500/10'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                        isRoster
                          ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                          : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                      }`}>
                        {isRoster ? <Sparkles className="w-3.5 h-3.5 text-purple-400" /> : <FolderIcon className="w-3.5 h-3.5 text-cyan-400" />}
                        {isRoster ? 'CSP Roster' : 'Simple Shift'}
                      </span>

                      <div className={`w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 transition-colors ${
                        isRoster ? 'group-hover:bg-purple-500 group-hover:text-slate-950' : 'group-hover:bg-cyan-500 group-hover:text-slate-950'
                      }`}>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    <h3 className={`text-lg font-bold text-white transition-colors mb-2 ${
                      isRoster ? 'group-hover:text-purple-300' : 'group-hover:text-cyan-300'
                    }`}>
                      {folder.name}
                    </h3>

                    <div className="space-y-2 py-3 border-t border-slate-800/80 text-xs text-slate-300">
                      {isRoster ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-purple-400" />
                              Today's Scheduled Shift:
                            </span>
                            <span className="font-semibold text-purple-300">
                              {todayShift ? `${todayShift.type} (${todayShift.startTime})` : 'Multi-Shift Roster'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              Schedule Horizon:
                            </span>
                            <span className="font-semibold text-slate-200">
                              {folder.rosterConfig?.daysCount || 7} Days ({folder.generatedShifts?.length || 0} shifts)
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" />
                              Shift Start Time:
                            </span>
                            <span className="font-mono font-bold text-white text-sm">
                              {folder.startTime}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              Grace Period:
                            </span>
                            <span className="font-semibold text-slate-200">
                              ±{folder.gracePeriodMinutes} mins
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          Assigned Staff:
                        </span>
                        <span className="font-semibold text-slate-200">
                          {memberCount} member{memberCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold ${
                    isRoster ? 'text-purple-400 group-hover:text-purple-300' : 'text-cyan-400 group-hover:text-cyan-300'
                  }`}>
                    <span>Tap to Biometric Punch</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
