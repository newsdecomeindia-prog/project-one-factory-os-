import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Factory, Plus, AlertCircle } from 'lucide-react';

export const PlantMaster: React.FC = () => {
  const { token } = useAuth();
  const [plants, setPlants] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionType, setActionType] = useState<'INACTIVE' | 'REVERSED'>('INACTIVE');
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plantCode: '',
    companyId: '',
    plantName: '',
    location: '',
    address: '',
    timezone: 'Asia/Kolkata',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resPlants, resCompanies] = await Promise.all([
        fetch('/api/v1/plants', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/companies', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataPlants = await resPlants.json();
      const dataCompanies = await resCompanies.json();

      if (dataPlants.success) setPlants(dataPlants.data);
      if (dataCompanies.success) setCompanies(dataCompanies.data);
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
      const res = await fetch('/api/v1/plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create plant');

      setShowModal(false);
      setForm({ plantCode: '', companyId: '', plantName: '', location: '', address: '', timezone: 'Asia/Kolkata' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDeactivateModal) return;
    try {
      const res = await fetch(`/api/v1/plants/${showDeactivateModal}/deactivate`, {
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
            <Factory className="w-5 h-5 text-blue-600" />
            Plant Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage manufacturing plant facilities and multi-location sites.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Plant
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading plants...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Plant Code</th>
                  <th className="p-3.5">Plant Name</th>
                  <th className="p-3.5">Company</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {plants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{p.plantCode}</td>
                    <td className="p-3.5 font-medium text-slate-900">{p.plantName}</td>
                    <td className="p-3.5 text-slate-600">{p.company?.displayName || 'N/A'}</td>
                    <td className="p-3.5 text-slate-600">{p.location || 'N/A'}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'REVERSED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {p.status === 'ACTIVE' && (
                        <button
                          onClick={() => setShowDeactivateModal(p.id)}
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
            <h2 className="text-base font-bold text-slate-900">Add New Plant</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company *</label>
                <select
                  required
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyCode} - {c.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant Code *</label>
                <input
                  required
                  value={form.plantCode}
                  onChange={(e) => setForm({ ...form, plantCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. PLANT-03"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant Name *</label>
                <input
                  required
                  value={form.plantName}
                  onChange={(e) => setForm({ ...form, plantName: e.target.value })}
                  placeholder="e.g. Pune Stampings Unit 3"
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
                  Save Plant
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
            <h2 className="text-base font-bold text-slate-900">Deactivate / Reverse Plant</h2>
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
                  placeholder="Explain why this plant state is being updated..."
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
