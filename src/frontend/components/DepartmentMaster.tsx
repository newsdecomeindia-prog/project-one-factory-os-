import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layers, Plus, AlertCircle } from 'lucide-react';

export const DepartmentMaster: React.FC = () => {
  const { token } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionType, setActionType] = useState<'INACTIVE' | 'REVERSED'>('INACTIVE');
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    departmentCode: '',
    plantId: '',
    departmentName: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resDepts, resPlants] = await Promise.all([
        fetch('/api/v1/departments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/plants', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataDepts = await resDepts.json();
      const dataPlants = await resPlants.json();

      if (dataDepts.success) setDepartments(dataDepts.data);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create department');

      setShowModal(false);
      setForm({ departmentCode: '', plantId: '', departmentName: '' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDeactivateModal) return;
    try {
      const res = await fetch(`/api/v1/departments/${showDeactivateModal}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, actionType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Action failed');

      setShowDeactivateModal(null);
      setReason('');
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
            <Layers className="w-5 h-5 text-blue-600" />
            Department Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage functional operational departments within plants.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading departments...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Department Code</th>
                  <th className="p-3.5">Department Name</th>
                  <th className="p-3.5">Plant</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{d.departmentCode}</td>
                    <td className="p-3.5 font-medium text-slate-900">{d.departmentName}</td>
                    <td className="p-3.5 text-slate-600">{d.plant?.plantName || 'N/A'}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          d.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : d.status === 'REVERSED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {d.status === 'ACTIVE' && (
                        <button
                          onClick={() => setShowDeactivateModal(d.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-md transition-colors"
                        >
                          Deactivate / Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Add New Department</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant *</label>
                <select
                  required
                  value={form.plantId}
                  onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Plant</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plantCode} - {p.plantName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department Code *</label>
                <input
                  required
                  value={form.departmentCode}
                  onChange={(e) => setForm({ ...form, departmentCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. DEPT-MAINT-01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department Name *</label>
                <input
                  required
                  value={form.departmentName}
                  onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
                  placeholder="e.g. Plant Maintenance & Utility"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Deactivate / Reverse Department</h2>
            <form onSubmit={handleDeactivate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target State</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="INACTIVE">Deactivate (INACTIVE)</option>
                  <option value="REVERSED">Reverse (REVERSED - Requires Permission)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mandatory Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this department state is being updated..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeactivateModal(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold">
                  Confirm Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
