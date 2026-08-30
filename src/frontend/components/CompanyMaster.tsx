import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { VoiceInput } from './VoiceInput';
import { Building2, Plus, AlertCircle } from 'lucide-react';

export const CompanyMaster: React.FC = () => {
  const { token } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionType, setActionType] = useState<'INACTIVE' | 'REVERSED'>('INACTIVE');
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyCode: '',
    legalName: '',
    displayName: '',
    legalDetails: '',
  });

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setCompanies(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create company');

      setShowModal(false);
      setForm({ companyCode: '', legalName: '', displayName: '', legalDetails: '' });
      fetchCompanies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDeactivateModal) return;
    try {
      const res = await fetch(`/api/v1/companies/${showDeactivateModal}/deactivate`, {
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
      fetchCompanies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Company Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage multi-company corporate entities and registration details.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading companies...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Company Code</th>
                  <th className="p-3.5">Display Name</th>
                  <th className="p-3.5">Legal Name</th>
                  <th className="p-3.5">Plants Count</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{c.companyCode}</td>
                    <td className="p-3.5 font-medium text-slate-900">{c.displayName}</td>
                    <td className="p-3.5 text-slate-600">{c.legalName}</td>
                    <td className="p-3.5 text-slate-600">{c.plants?.length || 0} Plants</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'REVERSED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {c.status === 'ACTIVE' && (
                        <button
                          onClick={() => setShowDeactivateModal(c.id)}
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
            <h2 className="text-base font-bold text-slate-900">Add New Company</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Code *</label>
                <div className="flex gap-2">
                  <input
                    required
                    value={form.companyCode}
                    onChange={(e) => setForm({ ...form, companyCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. COMP-02"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                  <VoiceInput onTranscript={(text) => setForm({ ...form, companyCode: text.toUpperCase().replace(/\s+/g, '') })} />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Name *</label>
                <input
                  required
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Apex Guj Unit"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Legal Name *</label>
                <input
                  required
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="e.g. Apex Manufacturing Pvt Ltd"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Legal Details (GST / Tax)</label>
                <input
                  value={form.legalDetails}
                  onChange={(e) => setForm({ ...form, legalDetails: e.target.value })}
                  placeholder="e.g. GSTIN: 27ABCDE1234F1Z5"
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
                  Save Company
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
            <h2 className="text-base font-bold text-slate-900">Deactivate / Reverse Company</h2>
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
                  placeholder="Explain why this company state is being updated..."
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
