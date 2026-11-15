import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  KeyRound,
  FileText,
  Search,
  Plus,
  RotateCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Copy,
  Check,
  Lock,
  X,
  Trash2,
  Activity,
  Server,
  Sparkles,
} from 'lucide-react';
import {
  getLicensingDB,
  seedLicensingDataIfNeeded,
  generateNewActivationCode,
  grantPermanentLicenceForInstallation,
  revokeActivationCode,
  type LicenceInstallation,
  type ActivationCodeRecord,
  type LicenceAuditLog,
} from '../utils/licensingDb';

interface LicensingAdminDashboardProps {
  onLogout: () => void;
  onBackToApp: () => void;
}

type AdminTab = 'installations' | 'codes' | 'audit';

export const LicensingAdminDashboard: React.FC<LicensingAdminDashboardProps> = ({ onLogout, onBackToApp }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('installations');
  const [installations, setInstallations] = useState<LicenceInstallation[]>([]);
  const [codes, setCodes] = useState<ActivationCodeRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<LicenceAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Granting Licence
  const [grantingInstallation, setGrantingInstallation] = useState<LicenceInstallation | null>(null);
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState<{ code: string; record: ActivationCodeRecord } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      await seedLicensingDataIfNeeded();
      const db = await getLicensingDB();
      const [insts, cList, audits] = await Promise.all([
        db.getAll('licence_installations'),
        db.getAll('licence_codes'),
        db.getAll('licence_audit'),
      ]);

      setInstallations(insts);
      setCodes(cList);
      setAuditLogs(audits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
      console.error('[LicensingDashboard] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Metrics calculation
  const totalInstallations = installations.length;
  const activeTrials = installations.filter((i) => i.activationStatus === 'trial' && i.trialStatus === 'active').length;
  const expiredTrials = installations.filter((i) => i.activationStatus === 'trial' && i.trialStatus === 'expired').length;
  const permanentActivated = installations.filter((i) => i.activationStatus === 'permanently_activated').length;
  const unredeemedCodes = codes.filter((c) => c.status === 'unused').length;

  // Filtered installations
  const filteredInstallations = installations.filter((i) => {
    const q = searchQuery.toLowerCase();
    return (
      i.installationId.toLowerCase().includes(q) ||
      i.clientName.toLowerCase().includes(q) ||
      i.publicKeyIdentity.toLowerCase().includes(q) ||
      i.deviceInfo.toLowerCase().includes(q)
    );
  });

  const handleGrantLicence = async () => {
    if (!grantingInstallation) return;
    setActionLoading(true);
    try {
      const result = await grantPermanentLicenceForInstallation(grantingInstallation.installationId);
      setNewlyGeneratedCode(result);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to grant licence');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateStandaloneCode = async () => {
    setActionLoading(true);
    try {
      const result = await generateNewActivationCode();
      setNewlyGeneratedCode(result);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to generate code');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (codeHash: string) => {
    if (!confirm('Are you sure you want to revoke this activation code?')) return;
    try {
      await revokeActivationCode(codeHash);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke code');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                OmniRoster Licensing Authority
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-400">
                /licensing-admin
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Enterprise Installation Management & Cryptographic Device Activation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh statistics"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onBackToApp}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Open PWA App</span>
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-950 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Admin</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ========================================================= */}
        {/* METRICS OVERVIEW CARDS                                    */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Installations</span>
              <Server className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">{totalInstallations}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Total registered devices</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Trials</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400 font-mono">{activeTrials}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Trial period ongoing</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Expired Trials</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-400 font-mono">{expiredTrials}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Requires upgrade code</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Activated</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400 font-mono">{permanentActivated}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Permanently licenced</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Unused Codes</span>
              <KeyRound className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-purple-400 font-mono">{unredeemedCodes}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Unredeemed activation keys</div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB NAVIGATION & ACTION BAR                               */}
        {/* ========================================================= */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('installations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'installations'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Registered Installations ({installations.length})
            </button>
            <button
              onClick={() => setActiveTab('codes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'codes'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Activation Codes ({codes.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Audit Log ({auditLogs.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === 'installations' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search installations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            {activeTab === 'codes' && (
              <button
                onClick={handleGenerateStandaloneCode}
                disabled={actionLoading}
                className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Activation Code</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB CONTENT 1: INSTALLATIONS TABLE                        */}
        {/* ========================================================= */}
        {activeTab === 'installations' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Registered OmniRoster Client Installations
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage trials, device fingerprints, and issue permanent activation licences.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3.5">Client & ID</th>
                    <th className="p-3.5">Registered / Activity</th>
                    <th className="p-3.5">Trial Status</th>
                    <th className="p-3.5">Activation Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredInstallations.map((inst) => {
                    const isTrialActive = inst.trialStatus === 'active';
                    const isActivated = inst.activationStatus === 'permanently_activated';
                    return (
                      <tr key={inst.installationId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white">{inst.clientName}</div>
                          <div className="text-[11px] font-mono text-blue-400">{inst.installationId}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{inst.deviceInfo}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-slate-300">Reg: {new Date(inst.registeredAt).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-500">Active: {new Date(inst.lastActivityAt).toLocaleTimeString()}</div>
                        </td>
                        <td className="p-3.5">
                          {isActivated ? (
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-medium">
                              N/A (Activated)
                            </span>
                          ) : isTrialActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold text-[11px]">
                              <Clock className="w-3 h-3" />
                              Active Trial (Exp: {new Date(inst.trialExpiresAt).toLocaleDateString()})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-[11px]">
                              <AlertTriangle className="w-3 h-3" />
                              Trial Expired
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {isActivated ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Permanently Activated
                              </span>
                              <div className="text-[10px] font-mono text-slate-400 mt-1">Licence ID: {inst.licenceId}</div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold text-[11px]">
                              <Shield className="w-3 h-3" />
                              Standard Trial
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          {!isActivated && (
                            <button
                              onClick={() => setGrantingInstallation(inst)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm cursor-pointer transition-all inline-flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Grant Permanent Licence</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInstallations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No installations found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB CONTENT 2: ACTIVATION CODES TABLE                     */}
        {/* ========================================================= */}
        {activeTab === 'codes' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  Activation Codes & Cryptographic Redemptions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track code issuance, one-time secure hashes, and associated client installations.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3.5">Licence ID & Code Preview</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Generated / Redeemed</th>
                    <th className="p-3.5">Bound Installation</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {codes.map((codeRec) => {
                    const isRedeemed = codeRec.status === 'redeemed';
                    const isRevoked = codeRec.status === 'revoked';
                    const isUnused = codeRec.status === 'unused';
                    return (
                      <tr key={codeRec.codeHash} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-white">{codeRec.licenceId}</div>
                          <div className="text-[11px] font-mono text-purple-400 mt-0.5">{codeRec.plaintextCodePreview}</div>
                        </td>
                        <td className="p-3.5">
                          {isRedeemed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Redeemed
                            </span>
                          ) : isRevoked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-[11px]">
                              <X className="w-3 h-3" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-semibold text-[11px]">
                              <KeyRound className="w-3 h-3" />
                              Unused
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="text-slate-300">Gen: {new Date(codeRec.generatedAt).toLocaleDateString()}</div>
                          {codeRec.redeemedAt && (
                            <div className="text-[11px] text-emerald-400">Redeemed: {new Date(codeRec.redeemedAt).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          {codeRec.associatedInstallationId ? (
                            <span className="font-mono text-blue-400">{codeRec.associatedInstallationId}</span>
                          ) : (
                            <span className="text-slate-500 italic">None (Standalone)</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          {isUnused && (
                            <button
                              onClick={() => handleRevoke(codeRec.codeHash)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-[11px] cursor-pointer transition-colors"
                            >
                              Revoke
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

        {/* ========================================================= */}
        {/* TAB CONTENT 3: AUDIT LOGS TABLE                           */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Licensing Security Audit Log
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tamper-evident chronological audit log of all code generation and device licensing events.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Details</th>
                    <th className="p-3.5">Admin User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3.5 font-bold text-blue-400">{log.action}</td>
                      <td className="p-3.5 text-slate-200">{log.details}</td>
                      <td className="p-3.5 text-purple-400">{log.adminUser}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* GRANT PERMANENT LICENCE / GENERATED CODE MODAL            */}
      {/* ========================================================= */}
      {grantingInstallation && !newlyGeneratedCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Grant Permanent Licence
              </h3>
              <button
                onClick={() => setGrantingInstallation(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                You are about to generate a secure, cryptographically bound permanent activation licence for:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
                <div className="text-white font-bold">{grantingInstallation.clientName}</div>
                <div className="text-blue-400 text-[11px]">ID: {grantingInstallation.installationId}</div>
                <div className="text-slate-500 text-[10px]">Pub Identity: {grantingInstallation.publicKeyIdentity}</div>
              </div>
              <p className="text-slate-400 text-[11px]">
                This will generate a unique one-time activation code. Once issued, the installation will be permanently activated upon code entry.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setGrantingInstallation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantLicence}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 cursor-pointer text-xs disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading ? <span>Generating Key...</span> : <span>Confirm & Generate Licence</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DISPLAY GENERATED ACTIVATION CODE MODAL (SHOWN ONCE)      */}
      {/* ========================================================= */}
      {newlyGeneratedCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Activation Code Generated</h3>
              <p className="text-xs text-slate-400 mt-1">
                Copy this secure code now. For security reasons, plaintext activation codes are displayed only once.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-400 font-mono text-sm font-bold tracking-wider select-all">
              {newlyGeneratedCode.code}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => copyToClipboard(newlyGeneratedCode.code)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Activation Code'}</span>
              </button>
              <button
                onClick={() => {
                  setNewlyGeneratedCode(null);
                  setGrantingInstallation(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
