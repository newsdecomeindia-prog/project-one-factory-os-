import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Check, Save, AlertCircle } from 'lucide-react';

export const RoleManagement: React.FC = () => {
  const { token } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [assignedPerms, setAssignedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRoles, resPerms] = await Promise.all([
        fetch('/api/v1/roles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/roles/permissions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataRoles = await resRoles.json();
      const dataPerms = await resPerms.json();

      if (dataRoles.success) {
        setRoles(dataRoles.data);
        if (dataRoles.data.length > 0 && !selectedRole) {
          setSelectedRole(dataRoles.data[0]);
          setAssignedPerms(dataRoles.data[0].permissions.map((p: any) => p.id));
        }
      }
      if (dataPerms.success) setPermissions(dataPerms.data);
    } catch (err: any) {
      setError('Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSelectRole = (role: any) => {
    setSelectedRole(role);
    setAssignedPerms(role.permissions.map((p: any) => p.id));
    setSuccessMsg(null);
  };

  const handleTogglePerm = (permId: string) => {
    setAssignedPerms((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissionIds: assignedPerms }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update permissions');

      setSuccessMsg(`Permissions updated successfully for role '${selectedRole.roleName}'`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const permsByModule = permissions.reduce((acc: any, p: any) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Roles & Configurable RBAC Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Define system security roles and assign granular module permissions.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" /> {successMsg}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading RBAC configuration...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 mb-3">System Roles</h2>
            <div className="space-y-1">
              {roles.map((r) => {
                const isSelected = selectedRole?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRole(r)}
                    className={`w-full text-left p-3 rounded-lg text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{r.roleName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {r.permissions.length} perms
                      </span>
                    </div>
                    {r.description && (
                      <p className={`text-[11px] mt-1 font-normal ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {r.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Permissions Matrix for <span className="text-blue-600">{selectedRole.roleName}</span>
                    </h2>
                    <p className="text-xs text-slate-500">Check or uncheck permissions to adjust server-side capability grants.</p>
                  </div>
                  <button
                    onClick={handleSavePermissions}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Matrix'}
                  </button>
                </div>

                <div className="space-y-6">
                  {Object.keys(permsByModule).map((module) => (
                    <div key={module} className="border border-slate-100 rounded-lg p-4 bg-slate-50/50 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
                        {module} Module
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {permsByModule[module].map((p: any) => {
                          const checked = assignedPerms.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start space-x-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                checked ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleTogglePerm(p.id)}
                                className="mt-0.5 text-blue-600 focus:ring-blue-500 rounded"
                              />
                              <div>
                                <p className="font-semibold">{p.permissionCode}</p>
                                {p.description && <p className="text-[11px] text-slate-500">{p.description}</p>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">Select a role to view its permission matrix.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
