import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  X,
  CheckSquare,
  Square,
  User,
  Folder as FolderIcon,
  Sparkles,
} from 'lucide-react';
import type { AttendanceRecord } from '../utils/db';
import { downloadCSV, generateCSV } from '../utils/csvExport';
import { ExportModal } from './ExportModal';

interface AttendanceViewerProps {
  onRefresh?: () => void;
}

interface ColumnOption {
  id: string;
  label: string;
  selected: boolean;
}

export const AttendanceViewer: React.FC<AttendanceViewerProps> = ({ onRefresh }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Custom CSV Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [columns, setColumns] = useState<ColumnOption[]>([
    { id: 'name', label: 'Employee Name', selected: true },
    { id: 'folder', label: 'Shift Folder', selected: true },
    { id: 'datetime', label: 'Date / Time', selected: true },
    { id: 'status', label: 'Arrival Status', selected: true },
    { id: 'snapshot', label: 'Snapshot Photo Proof', selected: false },
    { id: 'confidence', label: 'Biometric Confidence (%)', selected: false },
  ]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.attendance || []);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('[AttendanceViewer] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [search, dateFrom, dateTo, statusFilter]);

  // Real-time filtering by Employee Name or Folder Name
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const empName = (r.employeeName || '').toLowerCase();
      const folder = (r.folderName || '').toLowerCase();
      const empId = (r.employeeId || '').toLowerCase();
      return empName.includes(q) || folder.includes(q) || empId.includes(q);
    });
  }, [records, search]);

  const toggleColumn = (id: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, selected: !col.selected } : col))
    );
  };

  const handleExportCSV = async () => {
    const selectedCols = columns.filter((c) => c.selected).map((c) => c.id);
    if (selectedCols.length === 0) {
      alert('Please select at least one column to export.');
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('columns', selectedCols.join(','));

      const res = await fetch(`/api/attendance/export?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to generate CSV export');

      const csvText = await res.text();
      const filename = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(filename, csvText);

      setShowExportModal(false);
    } catch (err) {
      console.error('[AttendanceViewer] Export error:', err);
      alert('Export failed. Please check logs.');
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'on_time':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ON TIME
          </span>
        );
      case 'early':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            EARLY
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            LATE
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            DUPLICATE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Card */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Attendance Audit Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Audit punch timestamps, arrival statuses, and export customized RFC-4180 CSV reports
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchRecords()}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Ledger"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search Input - Universal Search */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
            <span>Search Attendance</span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by Employee or Folder..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Arrival Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
            <option value="early">Early</option>
            <option value="duplicate">Duplicate Check-In</option>
          </select>
        </div>
      </div>

      {/* Table Results */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center">
            <RotateCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span>Loading records from local store...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {search ? `No attendance records match "${search}"` : 'No attendance records match filter criteria.'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try clearing the search or date parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Shift Folder</th>
                  <th className="px-4 py-3">Arrival Status</th>
                  <th className="px-4 py-3">Biometrics</th>
                  <th className="px-4 py-3 text-right">Photo Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {r.employeeName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.employeeId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <FolderIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        {r.folderName}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {r.matchedConfidence}% confidence
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.snapshotBase64 ? (
                        <div className="inline-block relative w-8 h-8 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
                          <img
                            src={r.snapshotBase64}
                            alt="Punch Snapshot"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visual Export Format Selector Modal (CSV vs PDF) */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        records={filteredRecords}
        dateRangeText={
          dateFrom && dateTo
            ? `${dateFrom} to ${dateTo}`
            : dateFrom
            ? `From ${dateFrom}`
            : dateTo
            ? `Until ${dateTo}`
            : 'All recorded dates'
        }
        onExportCSVFallback={handleExportCSV}
      />
    </div>
  );
};
