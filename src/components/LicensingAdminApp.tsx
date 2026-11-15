import React, { useState } from 'react';
import { LicensingAdminLogin } from './LicensingAdminLogin';
import { LicensingAdminDashboard } from './LicensingAdminDashboard';

export const LicensingAdminApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('omni_licence_admin_auth') === 'true';
  });

  const handleBackToApp = () => {
    window.location.href = '/';
  };

  if (!isAuthenticated) {
    return (
      <LicensingAdminLogin
        onLoginSuccess={() => setIsAuthenticated(true)}
        onBackToApp={handleBackToApp}
      />
    );
  }

  return (
    <LicensingAdminDashboard
      onLogout={() => {
        sessionStorage.removeItem('omni_licence_admin_auth');
        setIsAuthenticated(false);
      }}
      onBackToApp={handleBackToApp}
    />
  );
};
