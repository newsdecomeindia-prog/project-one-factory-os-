import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, AlertCircle } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    roleIds: [] as string[],
    plantIds: [] as string[],
    departmentIds: [] as string[],
  });

  const [accessForm, setAccessForm] = useState({
    roleIds: [] as string[],
    plantIds: [] as string[],
    departmentIds: [] as string[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resRoles, resPlants] = await Promise.all([
        fetch('/api/v1/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/roles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/plants', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataUsers = await resUsers.json();
      const dataRoles = await resRoles.json();
      const dataPlants = await resPlants.json();

      if (dataUsers.success) setUsers(dataUsers.data);
      if (dataRoles.success) setRoles(dataRoles.data);
      if (dataPlants.success) setPlants(dataPlants.data);
    } catch (err: any) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create user');

      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openAccessModal = (user: any) => {
    setShowAccessModal(user.id);
    setAccessForm({
      roleIds: user.roles.map((r: any) => r.id),
      plantIds: user.plants.map((p: any) => p.id),
      departmentIds: user.departments.map((d: any) => d.id),
    });
  };

  const handleUpdateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAccessModal) return;
    try {
      const res = await fetch(`/api/v1/users/${showAccessModal}/access`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(accessForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update access');

      setShowAccessModal(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            User Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage enterprise accounts, roles, and plant/department scope.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New User
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading users...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Company / Tenant</th>
                  <th className="p-3.5">Assigned Roles</th>
                  <th className="p-3.5">Plant Scope</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-slate-900">{u.firstName} {u.lastName}</p>
                      <p className="text-slate-500 text-[11px] font-mono">{u.email}</p>
                    </td>
                    <td className="p-3.5 font-medium text-slate-700">{u.companyName}</td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r: any) => (
                          <span key={r.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-medium">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.plants.length > 0 ? (
                          u.plants.map((p: any) => (
                            <span key={p.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                              {p.code}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No Plant Scope</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800">
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => openAccessModal(u)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium rounded-md transition-colors"
                      >
                        Manage Scope & Roles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full rounded-xl shadow-xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900">Create Enterprise Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  required
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Roles Multi Select */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Roles</label>
                <div className="p-2 border rounded-lg max-h-32 overflow-y-auto space-y-1">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={createForm.roleIds.includes(r.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCreateForm((prev) => ({
                            ...prev,
                            roleIds: checked ? [...prev.roleIds, r.id] : prev.roleIds.filter((id) => id !== r.id),
                          }));
                        }}
                      />
                      <span>{r.roleName}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Plant Access Multi Select */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant Access Authorization</label>
                <div className="p-2 border rounded-lg max-h-32 overflow-y-auto space-y-1">
                  {plants.map((p) => (
                    <label key={p.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={createForm.plantIds.includes(p.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCreateForm((prev) => ({
                            ...prev,
                            plantIds: checked ? [...prev.plantIds, p.id] : prev.plantIds.filter((id) => id !== p.id),
                          }));
                        }}
                      />
                      <span>{p.plantCode} - {p.plantName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Scope Modal */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-xl shadow-xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900">Manage Scope & Roles</h2>
            <form onSubmit={handleUpdateAccess} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Roles</label>
                <div className="p-2.5 border rounded-lg space-y-1 max-h-36 overflow-y-auto">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={accessForm.roleIds.includes(r.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAccessForm((prev) => ({
                            ...prev,
                            roleIds: checked ? [...prev.roleIds, r.id] : prev.roleIds.filter((id) => id !== r.id),
                          }));
                        }}
                      />
                      <span>{r.roleName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant Authorization Scope</label>
                <div className="p-2.5 border rounded-lg space-y-1 max-h-36 overflow-y-auto">
                  {plants.map((p) => (
                    <label key={p.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={accessForm.plantIds.includes(p.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAccessForm((prev) => ({
                            ...prev,
                            plantIds: checked ? [...prev.plantIds, p.id] : prev.plantIds.filter((id) => id !== p.id),
                          }));
                        }}
                      />
                      <span>{p.plantCode} - {p.plantName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccessModal(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold">
                  Update Scope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
