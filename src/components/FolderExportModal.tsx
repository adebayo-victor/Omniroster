import React, { useState } from 'react';
import {
  X,
  Share2,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Folder as FolderIcon,
  Copy,
  Clock,
  Download,
} from 'lucide-react';
import type { Folder, Employee } from '../utils/db';
import {
  copyRosterToClipboard,
  downloadFolderRosterCSV,
  getFolderScheduleRows,
} from '../utils/rosterExport';
import { downloadFolderRosterPDF } from './FolderRosterPDF';

export interface FolderExportModalProps {
  isOpen: boolean;
  folder: Folder | null;
  employees: Employee[];
  onClose: () => void;
}

export const FolderExportModal: React.FC<FolderExportModalProps> = ({
  isOpen,
  folder,
  employees,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'clipboard' | 'pdf' | 'csv'>('clipboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen || !folder) return null;

  const rows = getFolderScheduleRows(folder, employees);
  const isRoster = folder.type === 'optimized_roster';
  const assignedStaffCount = folder.assignedEmployeeIds?.length || 0;

  const handleExport = async (format: 'clipboard' | 'pdf' | 'csv' = selectedFormat) => {
    setIsProcessing(true);
    setFeedbackMessage(null);

    try {
      if (format === 'clipboard') {
        const ok = await copyRosterToClipboard(folder, employees);
        if (ok) {
          setFeedbackMessage('Schedule copied to clipboard! Ready to paste into WhatsApp, Email, or SMS.');
        } else {
          setFeedbackMessage('Failed to copy. Please allow clipboard permissions.');
        }
      } else if (format === 'pdf') {
        await downloadFolderRosterPDF(folder, employees, {
          companyName: 'OmniRoster OS',
        });
        setFeedbackMessage('Professional vector PDF timetable generated and downloaded!');
      } else if (format === 'csv') {
        downloadFolderRosterCSV(folder, employees);
        setFeedbackMessage('Excel/CSV spreadsheet generated and downloaded successfully!');
      }

      // Auto-close on success after a short delay
      setTimeout(() => {
        setIsProcessing(false);
      }, 800);
    } catch (err) {
      console.error('[FolderExportModal] Export failed:', err);
      alert('An error occurred during export. Please check the browser console.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                isRoster
                  ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  : 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              }`}>
                {isRoster ? <Sparkles className="w-3 h-3 text-purple-500" /> : <FolderIcon className="w-3 h-3 text-blue-500" />}
                {isRoster ? 'Optimized Roster' : 'Simple Shift'}
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Export Roster & Timetable
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select your export format for <strong className="text-slate-700 dark:text-slate-200">{folder.name}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Schedule Summary Banner */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 rounded-xl text-xs border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {rows.length} {rows.length === 1 ? 'shift entry' : 'shift entries'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{assignedStaffCount} staff in pool</span>
          </div>
        </div>

        {/* Three Export Options */}
        <div className="space-y-2.5">
          {/* Option 1: Clipboard Text */}
          <div
            onClick={() => !isProcessing && setSelectedFormat('clipboard')}
            onDoubleClick={() => !isProcessing && handleExport('clipboard')}
            className={`group p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between select-none ${
              selectedFormat === 'clipboard'
                ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  selectedFormat === 'clipboard'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Copy to Clipboard (Text)
                  </h4>
                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    WhatsApp & SMS
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Clean emoji-formatted schedule (📅 ⏰ 👤) ready to paste directly into group chats or emails.
                </p>
              </div>
            </div>

            <div className="shrink-0 pl-2">
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedFormat === 'clipboard'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                {selectedFormat === 'clipboard' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </span>
            </div>
          </div>

          {/* Option 2: Professional PDF */}
          <div
            onClick={() => !isProcessing && setSelectedFormat('pdf')}
            onDoubleClick={() => !isProcessing && handleExport('pdf')}
            className={`group p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between select-none ${
              selectedFormat === 'pdf'
                ? 'border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  selectedFormat === 'pdf'
                    ? 'bg-[#3D3226] text-[#D4AF37] shadow-xs'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}
              >
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Download PDF Timetable
                  </h4>
                  <span className="text-[10px] font-semibold bg-[#3D3226] text-[#D4AF37] px-2 py-0.5 rounded-full border border-[#C5A059]/40">
                    Dark Brown & Gold
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Print-ready vector document styled with corporate Dark Brown & Cream palette and signature lines.
                </p>
              </div>
            </div>

            <div className="shrink-0 pl-2">
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedFormat === 'pdf'
                    ? 'border-amber-700 bg-amber-700 text-white'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                {selectedFormat === 'pdf' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </span>
            </div>
          </div>

          {/* Option 3: Excel (CSV) */}
          <div
            onClick={() => !isProcessing && setSelectedFormat('csv')}
            onDoubleClick={() => !isProcessing && handleExport('csv')}
            className={`group p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between select-none ${
              selectedFormat === 'csv'
                ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  selectedFormat === 'csv'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Export Excel (CSV)
                  </h4>
                  <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    Spreadsheet / Payroll
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  RFC-4180 standard spreadsheet file with dates, shift windows, and assigned staff for payroll software.
                </p>
              </div>
            </div>

            <div className="shrink-0 pl-2">
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedFormat === 'csv'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                {selectedFormat === 'csv' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {feedbackMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleExport()}
            disabled={isProcessing}
            className={`px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
              selectedFormat === 'clipboard'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : selectedFormat === 'pdf'
                ? 'bg-[#3D3226] hover:bg-[#2A231A] text-[#FAF8F5]'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Exporting...</span>
              </>
            ) : selectedFormat === 'clipboard' ? (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy to Clipboard</span>
              </>
            ) : selectedFormat === 'pdf' ? (
              <>
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Download PDF Timetable</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download CSV (Excel)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
