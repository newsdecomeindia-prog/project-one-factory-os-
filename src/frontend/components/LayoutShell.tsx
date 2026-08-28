import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { QRScanner } from './QRScanner';
import {
  Building2,
  Factory,
  Layers,
  Users,
  ShieldCheck,
  FileSearch,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Activity,
  ChevronRight,
} from 'lucide-react';

interface LayoutShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout, activePlantId, setActivePlantId } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const navigation = [
    { id: 'companies', name: 'Company Master', icon: Building2, perm: 'company:read' },
    { id: 'plants', name: 'Plant Master', icon: Factory, perm: 'plant:read' },
    { id: 'departments', name: 'Department Master', icon: Layers, perm: 'department:read' },
    { id: 'users', name: 'User Management', icon: Users, perm: 'user:read' },
    { id: 'roles', name: 'Roles & RBAC', icon: ShieldCheck, perm: 'role:read' },
    { id: 'audit', name: 'Audit Trail', icon: FileSearch, perm: 'audit:read' },
  ];

  const filteredNav = navigation.filter(
    (item) => user?.isSuperAdmin || user?.permissions.includes(item.perm)
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex-shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-wider text-base">PROJECT ONE</h1>
            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest">
              {user?.companyName || 'Multi-Tenant OS'}
            </p>
          </div>
        </div>

        {/* Plant Context Selector */}
        {user && user.plants.length > 0 && (
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Active Plant Scope
            </label>
            <select
              value={activePlantId || ''}
              onChange={(e) => setActivePlantId(e.target.value || null)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {user.isSuperAdmin && <option value="">All Plants (Super Admin)</option>}
              {user.plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <p className="text-xs font-semibold text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{user?.roles[0] || 'User'}</p>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Top Nav */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Building2 className="w-6 h-6 text-blue-500" />
          <span className="font-bold tracking-wider text-sm">PROJECT ONE</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-2">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium ${
                activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>
          ))}
          <button
            onClick={logout}
            className="w-full flex items-center space-x-3 p-3 text-red-400 hover:bg-slate-800 rounded-lg text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Universal Search (Part#, PO#, GRN#, Users...)"
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <QRScanner onScan={(code) => setSearchResult(`Scanned Barcode: ${code}`)} />
          </div>

          <div className="flex items-center space-x-4">
            {searchResult && (
              <span className="hidden sm:inline-block px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded-lg font-mono">
                {searchResult}
              </span>
            )}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium">
              <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Engine Status: Online</span>
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Area */}
        <main className="flex-1 p-6 overflow-y-auto bg-slate-50">{children}</main>
      </div>
    </div>
  );
};
