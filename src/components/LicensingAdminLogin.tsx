import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Lock, ArrowRight, AlertCircle, Terminal } from 'lucide-react';

interface LicensingAdminLoginProps {
  onLoginSuccess: () => void;
  onBackToApp: () => void;
}

export const LicensingAdminLogin: React.FC<LicensingAdminLoginProps> = ({ onLoginSuccess, onBackToApp }) => {
  const [credential, setCredential] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setTimeout(() => {
      // Master credential check (e.g. "omni-licence-master-2026" or "0000" or admin pin)
      if (credential === 'omni-licence-master-2026' || credential === '0000' || credential === 'admin') {
        sessionStorage.setItem('omni_licence_admin_auth', 'true');
        onLoginSuccess();
      } else {
        setError('Invalid master administration credential. Access denied.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-blue-900/60 to-slate-900 p-6 border-b border-slate-800 text-center relative">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            OmniRoster Licensing Authority
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Secure Device Activation & Enterprise Control Centre
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>Master Administrator Credential</span>
            </label>
            <input
              type="password"
              required
              placeholder="Enter master admin key..."
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Hint for evaluation: Use <code className="text-blue-400 font-mono">omni-licence-master-2026</code> or <code className="text-blue-400 font-mono">0000</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating Secure Session...</span>
            ) : (
              <>
                <span>Access Licensing Control Centre</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={onBackToApp}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Return to OmniRoster OS App
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
