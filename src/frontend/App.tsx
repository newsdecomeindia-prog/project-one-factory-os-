import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useInactivityLock } from './hooks/useInactivityLock';
import { LockScreenOverlay } from './components/LockScreenOverlay';
import { LoginScreen } from './components/LoginScreen';
import { LayoutShell } from './components/LayoutShell';
import { CompanyMaster } from './components/CompanyMaster';
import { PlantMaster } from './components/PlantMaster';
import { DepartmentMaster } from './components/DepartmentMaster';
import { UserManagement } from './components/UserManagement';
import { RoleManagement } from './components/RoleManagement';
import { AuditTrailViewer } from './components/AuditTrailViewer';

const MainApp: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('companies');
  const { isLocked, unlock } = useInactivityLock();

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <>
      {isLocked && <LockScreenOverlay onUnlockSuccess={unlock} />}
      <LayoutShell activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'companies' && <CompanyMaster />}
        {activeTab === 'plants' && <PlantMaster />}
        {activeTab === 'departments' && <DepartmentMaster />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'roles' && <RoleManagement />}
        {activeTab === 'audit' && <AuditTrailViewer />}
      </LayoutShell>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};
