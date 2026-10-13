import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  // Forced PIN change state (triggered if master PIN is default "0000" or first login flag is active)
  const [mustChangePin, setMustChangePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  // Fetch initial settings to check if first run
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.isFirstLogin) {
            setIsFirstLogin(true);
          }
        }
      } catch (err) {
        console.warn('[AdminLogin] Settings fetch note:', err);
      }
    })();
  }, []);

  const handleKeyClick = (val: string) => {
    if (mustChangePin) return;
    if (pin.length < 4) {
      setPin((prev) => prev + val);
      setError(null);
    }
  };

  const handleBackspace = () => {
    if (mustChangePin) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (mustChangePin) return;
    setPin('');
    setError(null);
  };

  // Submit initial PIN authentication
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect Admin PIN. Please try again.');
        setPin('');
        return;
      }

      // First run detection: if default PIN "0000" or isFirstLogin flag
      if (data.isFirstLogin || pin === '0000') {
        setMustChangePin(true);
      } else {
        onLoginSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 4 digits are keyed in
  useEffect(() => {
    if (pin.length === 4 && !mustChangePin) {
      handleAuthSubmit();
    }
  }, [pin, mustChangePin]);

  // Submit forced new PIN
  const handleUpdatePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setChangeError('New PIN must be exactly 4 numeric digits.');
      return;
    }

    if (newPin === '0000') {
      setChangeError('New PIN cannot be the default "0000". Choose a distinct master PIN.');
      return;
    }

    if (newPin !== confirmPin) {
      setChangeError('The new PIN and confirmation PIN do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update master PIN');
      }

      // PIN updated successfully, advance to admin portal!
      onLoginSuccess();
    } catch (err: unknown) {
      setChangeError(err instanceof Error ? err.message : 'PIN update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* FORCED FIRST-RUN PIN CHANGE */}
        {mustChangePin ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Mandatory Master PIN Setup
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                First-time setup detected. You must change the default PIN (0000) to a custom 4-digit PIN to secure this terminal.
              </p>
            </div>

            {changeError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{changeError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New 4-Digit Admin PIN
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    autoFocus
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center tracking-widest text-xl font-mono pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New PIN
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center tracking-widest text-xl font-mono pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Save PIN & Open Admin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* STANDARD ADMIN PIN AUTHENTICATION */
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400 shadow-md">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Admin Authentication</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isFirstLogin ? (
                  <span className="text-amber-400 font-medium">
                    First login: Use default PIN 0000
                  </span>
                ) : (
                  'Enter 4-digit Master PIN to unlock Office Ribbon'
                )}
              </p>
            </div>

            {/* PIN Indicator Dots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      filled
                        ? 'bg-cyan-400 scale-110 shadow-md shadow-cyan-400/50'
                        : 'border-2 border-slate-700 bg-slate-800'
                    }`}
                  />
                );
              })}
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-center gap-2 animate-shake">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Tactile Keypad */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyClick(digit)}
                  className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 font-bold text-lg text-white transition-all shadow-sm flex items-center justify-center cursor-pointer select-none"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer select-none"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 font-bold text-lg text-white transition-all shadow-sm flex items-center justify-center cursor-pointer select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer select-none"
              >
                ⌫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
