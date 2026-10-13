import React, { useState } from 'react';
import { EmployeeHome } from './components/EmployeeHome';
import { PunchInFlow } from './components/PunchInFlow';
import { AdminLogin } from './components/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import type { Folder } from './utils/db';

type AppMode = 'employee_home' | 'punch_in' | 'admin';

export default function App() {
  const [mode, setMode] = useState<AppMode>('employee_home');
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 1. EMPLOYEE HOME SCREEN */}
      {mode === 'employee_home' && (
        <EmployeeHome
          onSelectFolder={(folder) => {
            setSelectedFolder(folder);
            setMode('punch_in');
          }}
          onOpenAdmin={() => setShowAdminLogin(true)}
        />
      )}

      {/* 2. PUNCH-IN FLOW (FACE SCAN -> MATCH INFO -> APPROVE -> STATUS) */}
      {mode === 'punch_in' && selectedFolder && (
        <PunchInFlow
          folder={selectedFolder}
          onBack={() => {
            setSelectedFolder(null);
            setMode('employee_home');
          }}
        />
      )}

      {/* 3. ADMIN MANAGEMENT (MICROSOFT WORD-STYLE RIBBON UI) */}
      {mode === 'admin' && (
        <AdminLayout
          onExitAdmin={() => {
            setMode('employee_home');
          }}
        />
      )}

      {/* ADMIN AUTHENTICATION MODAL (WITH FORCED PIN CHANGE ON FIRST RUN) */}
      {showAdminLogin && (
        <AdminLogin
          onLoginSuccess={() => {
            setShowAdminLogin(false);
            setMode('admin');
          }}
          onCancel={() => setShowAdminLogin(false)}
        />
      )}
    </div>
  );
}
