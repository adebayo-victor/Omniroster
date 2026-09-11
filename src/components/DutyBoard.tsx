import React, { useState } from 'react';
import { AttendanceLog, RosterFolder, RosterMember } from '../types';
import { formatShiftDisplay } from '../utils/storage';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Hourglass,
  UserCheck,
  UserX,
  Plus,
  KeyRound,
  Sparkles,
} from 'lucide-react';

interface DutyBoardProps {
  activeRoster: RosterFolder | null;
  todayLogs: AttendanceLog[];
  onSelectMemberForCheckIn: (member: RosterMember) => void;
  onOpenAddStaff: () => void;
}

export const DutyBoard: React.FC<DutyBoardProps> = ({
  activeRoster,
  todayLogs,
  onSelectMemberForCheckIn,
  onOpenAddStaff,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');

  if (!activeRoster) {
    return (
      <div className="text-center py-16 px-4 glass-panel rounded-2xl border border-white/5">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-200">No Roster Selected</h3>
        <p className="text-sm text-slate-400 mt-1">
          Select or create a duty roster from the departments above.
        </p>
      </div>
    );
  }

  const members = activeRoster.members || [];

  // Filter members by search and status
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.customVal && member.customVal.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const log = todayLogs.find(
      (l) => l.rosterId === activeRoster.id && l.memberId === member.id
    );

    if (filterType === 'PENDING') return !log;
    if (filterType === 'VERIFIED') return !!log;
    return true;
  });

  // Calculate live stats
  const totalCount = members.length;
  const verifiedCount = members.filter((m) =>
    todayLogs.some((l) => l.rosterId === activeRoster.id && l.memberId === m.id)
  ).length;
  const pendingCount = totalCount - verifiedCount;
  const onTimeCount = members.filter((m) =>
    todayLogs.some(
      (l) => l.rosterId === activeRoster.id && l.memberId === m.id && l.status === 'ON_TIME'
    )
  ).length;
  const lateCount = members.filter((m) =>
    todayLogs.some(
      (l) => l.rosterId === activeRoster.id && l.memberId === m.id && l.status === 'LATE'
    )
  ).length;
  const earlyCount = members.filter((m) =>
    todayLogs.some(
      (l) => l.rosterId === activeRoster.id && l.memberId === m.id && l.status === 'EARLY'
    )
  ).length;

  return (
    <div className="w-full space-y-4">
      {/* Roster Header & Live Statistics */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-extrabold text-xl text-white tracking-tight">
              {activeRoster.name}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Active Shift
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {formatShiftDisplay(activeRoster.shiftStart)} - {formatShiftDisplay(activeRoster.shiftEnd)}
            </span>
            <span>•</span>
            <span>Grace Window: <strong className="text-amber-300">{activeRoster.graceMin} mins</strong></span>
            {activeRoster.customColName && (
              <>
                <span>•</span>
                <span>Assignment: <strong className="text-slate-200">{activeRoster.customColName}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center shrink-0">
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
            <div className="font-display text-lg font-black text-white">{totalCount}</div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scheduled</div>
          </div>
          <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/20">
            <div className="font-display text-lg font-black text-amber-300">{pendingCount}</div>
            <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Pending</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
            <div className="font-display text-lg font-black text-emerald-300">{onTimeCount}</div>
            <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">On Time</div>
          </div>
          <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/20">
            <div className="font-display text-lg font-black text-rose-300">{lateCount}</div>
            <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Late</div>
          </div>
          <div className="p-2 rounded-xl bg-sky-950/30 border border-sky-500/20 col-span-3 sm:col-span-1">
            <div className="font-display text-lg font-black text-sky-300">{earlyCount}</div>
            <div className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Early</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff by name or counter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'ALL'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Staff ({members.length})
          </button>
          <button
            onClick={() => setFilterType('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'PENDING'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilterType('VERIFIED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'VERIFIED'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            Verified ({verifiedCount})
          </button>
        </div>
      </div>

      {/* Staff Timetable - Core Main Stage */}
      {!activeRoster.members || activeRoster.members.length === 0 ? (
        <div className="text-center py-16 px-4 glass-panel rounded-2xl border border-white/5 space-y-3">
          <UserX className="w-12 h-12 text-slate-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-200">
            No staff scheduled in this folder.
          </h4>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Admin can add members via the Admin Center.
          </p>
          <button
            onClick={onOpenAddStaff}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Admin Center — Add Members</span>
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-16 px-4 glass-panel rounded-2xl border border-white/5 space-y-3">
          <UserX className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-slate-300">
            No matching staff found
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try changing your search query or clear the filter.
          </p>
        </div>
      ) : (
        /* Full Structured HTML Timetable */
        <div className="w-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/90 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <th scope="col" className="py-3.5 px-4 w-16 text-center">
                    Photo
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Staff Name
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    {activeRoster.customColName || 'Custom Property'}
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Scheduled Shift
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Live Attendance Status
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {filteredMembers.map((member) => {
                  const log = todayLogs.find(
                    (l) => l.rosterId === activeRoster.id && l.memberId === member.id
                  );
                  const isCheckedIn = !!log;

                  const initials = member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={member.id}
                      id={`timetable-row-${member.id}`}
                      onClick={() => onSelectMemberForCheckIn(member)}
                      className={`group transition-colors duration-150 cursor-pointer ${
                        isCheckedIn
                          ? 'bg-slate-900/40 hover:bg-slate-800/50'
                          : 'hover:bg-emerald-950/20'
                      }`}
                    >
                      {/* 1. Photo Avatar Column */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          {member.profilePhotoBase64 ? (
                            <img
                              src={member.profilePhotoBase64}
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/40 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 text-emerald-300 font-bold font-display text-xs flex items-center justify-center shadow-inner">
                              {initials}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Staff Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                            {member.name}
                          </span>
                        </div>
                      </td>

                      {/* 3. Custom Property */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800/80 border border-white/10 text-slate-200 font-medium text-[11px]">
                          {member.customVal || '—'}
                        </span>
                      </td>

                      {/* 4. Scheduled Shift */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            {formatShiftDisplay(activeRoster.shiftStart)} -{' '}
                            {formatShiftDisplay(activeRoster.shiftEnd)}
                          </span>
                        </div>
                      </td>

                      {/* 5. Live Attendance Status Badge */}
                      <td className="py-3 px-4">
                        {!isCheckedIn ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Hourglass className="w-3 h-3 text-amber-400" />
                            <span>⏳ Pending Arrival</span>
                          </span>
                        ) : log.status === 'ON_TIME' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/50">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>🟢 ON TIME ({log.time})</span>
                          </span>
                        ) : log.status === 'EARLY' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-950/50">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                            <span>🔵 EARLY ({log.time})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950/50">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>🟡 LATE ({log.time})</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Action Button */}
                      <td className="py-3 px-4 text-right">
                        {!isCheckedIn ? (
                          <button
                            type="button"
                            id={`btn-checkin-${member.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectMemberForCheckIn(member);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>🔑 Check In / Enter PIN</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            id={`btn-view-${member.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectMemberForCheckIn(member);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Verified (View)</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
