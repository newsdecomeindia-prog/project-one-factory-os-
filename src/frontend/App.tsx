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
import { BomManagement } from './components/BomManagement';
import { WorkOrderManagement } from './components/WorkOrderManagement';
import { MaterialIssueManagement } from './components/MaterialIssueManagement';
import { ProductionExecutionManagement } from './components/ProductionExecutionManagement';
import { ProductionReceiptManagement } from './components/ProductionReceiptManagement';
import { FinishedGoodsStock } from './components/FinishedGoodsStock';
import { ProductionReports } from './components/ProductionReports';

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
        {activeTab === 'bom' && <BomManagement />}
        {activeTab === 'workorders' && <WorkOrderManagement />}
        {activeTab === 'materialissues' && <MaterialIssueManagement />}
        {activeTab === 'executions' && <ProductionExecutionManagement />}
        {activeTab === 'receipts' && <ProductionReceiptManagement />}
        {activeTab === 'fgstock' && <FinishedGoodsStock />}
        {activeTab === 'reports' && <ProductionReports />}
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
