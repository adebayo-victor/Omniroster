import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Briefcase,
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCw,
  ShieldCheck,
} from 'lucide-react';
import type { Employee } from '../utils/db';

export interface MemberDetailsModalProps {
  isOpen: boolean;
  member: Employee | null;
  onClose: () => void;
  onSaved: (updatedMember: Employee) => void;
}

export const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({
  isOpen,
  member,
  onClose,
  onSaved,
}) => {
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever selected member changes
  useEffect(() => {
    if (member) {
      setRole(member.role || 'Staff');
      setDepartment(member.department || 'General');
      setPin(member.pin || '');
      setShowPin(false);
      setError(null);
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const hasBiometrics = Array.isArray(member.faceDescriptor) && member.faceDescriptor.length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const cleanRole = role.trim();
    const cleanDept = department.trim();
    const cleanPin = pin.trim();

    if (!cleanRole) {
      setError('Role cannot be empty.');
      return;
    }
    if (!cleanDept) {
      setError('Department cannot be empty.');
      return;
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('PIN must be exactly 4 numeric digits.');
      return;
    }

    setIsSaving(true);
    try {
      // Updates via PUT /api/employees/:id or /api/employees
      const res = await fetch(`/api/employees/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          role: cleanRole,
          department: cleanDept,
          pin: cleanPin,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update member');
      }

      const result = await res.json();
      const updatedMember: Employee = result.employee || {
        ...member,
        role: cleanRole,
        department: cleanDept,
        pin: cleanPin,
      };

      onSaved(updatedMember);
      onClose();
    } catch (err: unknown) {
      console.error('[MemberDetailsModal] Update error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
      >
        {/* Header with Avatar, Name, Employee ID */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                {member.profilePhotoBase64 ? (
                  <img
                    src={member.profilePhotoBase64}
                    alt={member.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    {member.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div>
              <h3
                id="member-modal-title"
                className="font-bold text-slate-900 dark:text-white text-lg leading-tight"
              >
                {member.fullName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  ID: {member.id}
                </span>
                <span className="text-[11px] text-slate-400">
                  Member Profile
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Editable Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              Role / Designation
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Lead Nurse, Floor Manager, Barista..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              required
            />
          </div>

          {/* Editable Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Intensive Care, Operations, Kitchen..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              required
            />
          </div>

          {/* 4-Digit PIN with Show/Hide Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              4-Digit PIN
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit PIN"
                className="w-full pl-3.5 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
                title={showPin ? 'Hide PIN' : 'Reveal PIN'}
                aria-label={showPin ? 'Hide PIN' : 'Reveal PIN'}
              >
                {showPin ? (
                  <EyeOff className="w-4 h-4 text-blue-600" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Used for secure manual backup punch authentication on the kiosk.
            </p>
          </div>

          {/* Biometric Status Row */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Biometric Enrollment Status
            </label>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {hasBiometrics ? (
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    {hasBiometrics ? 'Face Biometric Enrolled' : 'PIN Only (No Biometrics)'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {hasBiometrics
                      ? 'High-precision 128-point face descriptor is registered.'
                      : 'Member can only check in using the 4-digit PIN.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
