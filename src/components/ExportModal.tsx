import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  X,
  Download,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { AttendanceRecord } from '../utils/db';
import { downloadAttendancePDF } from './AttendancePDFDocument';
import { generateCSV, downloadCSV } from '../utils/csvExport';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AttendanceRecord[];
  dateRangeText?: string;
  onExportCSVFallback?: () => Promise<void> | void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  records,
  dateRangeText,
  onExportCSVFallback,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async (formatToExport: 'csv' | 'pdf' = selectedFormat) => {
    setIsExporting(true);
    setExportSuccess(null);

    try {
      if (formatToExport === 'csv') {
        if (onExportCSVFallback) {
          await onExportCSVFallback();
        } else {
          // Direct client-side CSV generation
          const headers = [
            'ID',
            'Employee Name',
            'Folder / Shift',
            'Timestamp',
            'Arrival Status',
            'Confidence (%)',
          ];
          const rows = records.map((r) => [
            r.id,
            r.employeeName,
            r.folderName,
            r.timestamp,
            r.status,
            r.matchedConfidence !== undefined ? Math.round(r.matchedConfidence) : 'N/A',
          ]);
          const csvString = generateCSV(headers, rows);
          const filename = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
          downloadCSV(filename, csvString);
        }
        setExportSuccess('CSV generated and downloaded successfully!');
      } else {
        // PDF Report Generation via @react-pdf/renderer
        await downloadAttendancePDF(records, {
          companyName: 'OmniRoster OS',
          reportTitle: 'Official Biometric Attendance Ledger',
          dateRangeText: dateRangeText || 'Current Ledger Scope',
          filename: `attendance-report-${new Date().toISOString().split('T')[0]}.pdf`,
        });
        setExportSuccess('PDF Audit Report generated and downloaded successfully!');
      }

      setTimeout(() => {
        setIsExporting(false);
        setExportSuccess(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('[ExportModal] Export failed:', err);
      alert('Failed to generate export file. Please check console for details.');
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Export Attendance Data
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose your format for external payroll processing or executive compliance
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close export modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Pill */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {records.length} {records.length === 1 ? 'record' : 'records'} ready
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateRangeText || 'All dates filtered'}</span>
          </div>
        </div>

        {/* Format Selector: Two Large Clear Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Option A: Excel (CSV) */}
          <div
            onClick={() => !isExporting && setSelectedFormat('csv')}
            onDoubleClick={() => !isExporting && handleExport('csv')}
            className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
              selectedFormat === 'csv'
                ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    selectedFormat === 'csv'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                {selectedFormat === 'csv' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Selected
                  </span>
                )}
              </div>

              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Excel (CSV)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Raw RFC-4180 data spreadsheet. Ideal for Microsoft Excel, Google Sheets, or importing into payroll systems.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="font-mono uppercase text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                .CSV
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Download Raw <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Option B: PDF Report */}
          <div
            onClick={() => !isExporting && setSelectedFormat('pdf')}
            onDoubleClick={() => !isExporting && handleExport('pdf')}
            className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
              selectedFormat === 'pdf'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    selectedFormat === 'pdf'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                {selectedFormat === 'pdf' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Selected
                  </span>
                )}
              </div>

              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                PDF Report
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Vector-rendered corporate report with audit header, color-coded status badges, and HR/Supervisor sign-off lines.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="font-mono uppercase text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                .PDF
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Download PDF <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Success / Status Message */}
        {exportSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExport(selectedFormat)}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
              selectedFormat === 'pdf'
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
            }`}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating {selectedFormat.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download as {selectedFormat === 'pdf' ? 'PDF Report' : 'Excel (CSV)'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
