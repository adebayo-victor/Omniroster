import React from 'react';
import { RosterFolder } from '../types';
import { formatShiftDisplay } from '../utils/storage';
import { FolderCheck, Users, Clock, PlusCircle } from 'lucide-react';

interface FolderSelectorProps {
  rosters: RosterFolder[];
  activeRosterId: number | null;
  onSelectRoster: (id: number) => void;
  onOpenNewFolderModal: () => void;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  rosters,
  activeRosterId,
  onSelectRoster,
  onOpenNewFolderModal,
}) => {
  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Active Duty Rosters & Departments
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
            {rosters.length} Folders
          </span>
        </div>
        <button
          onClick={onOpenNewFolderModal}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Roster</span>
        </button>
      </div>

      {/* Folders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {rosters.map((roster) => {
          const isActive = roster.id === activeRosterId;
          const memberCount = roster.members?.length || 0;

          return (
            <button
              key={roster.id}
              id={`roster-card-${roster.id}`}
              onClick={() => onSelectRoster(roster.id)}
              className={`text-left p-4 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                isActive
                  ? 'glass-panel-active ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-950/50'
                  : 'glass-panel-interactive'
              }`}
            >
              {/* Active Emerald Glow Accent bar */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500" />
              )}

              <div className="flex items-start justify-between gap-2">
                <h3
                  className={`font-display font-bold text-base line-clamp-1 ${
                    isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'
                  }`}
                >
                  {roster.name}
                </h3>
                {isActive && (
                  <span className="shrink-0 flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                )}
              </div>

              {/* Shift info and badges */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1 text-slate-300 font-mono bg-slate-900/60 px-2 py-0.5 rounded border border-white/5">
                  <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>
                    {formatShiftDisplay(roster.shiftStart)} - {formatShiftDisplay(roster.shiftEnd)}
                  </span>
                </div>

                <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/20 font-medium">
                  {roster.graceMin}m Grace
                </span>

                <div className="flex items-center gap-1 text-slate-400 ml-auto">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-300">{memberCount} Staff</span>
                </div>
              </div>

              {roster.customColName && (
                <div className="mt-2 text-[11px] text-slate-400 truncate">
                  Property Column:{' '}
                  <span className="text-slate-300 font-medium">{roster.customColName}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
