import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PackageMinus, Plus, AlertCircle } from 'lucide-react';

export const MaterialIssueManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    workOrderId: '',
    materialId: '',
    issuedQuantity: 100,
    warehouseId: '',
    binId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = activePlantId ? `/api/v1/material-issues?plantId=${activePlantId}` : '/api/v1/material-issues';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setIssues(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch material issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activePlantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/material-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Material issue failed');

      setShowModal(false);
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
            <PackageMinus className="w-5 h-5 text-blue-600" />
            Material Issue Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Issue raw components from stock to active work orders.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Post Material Issue
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading material issues...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Issue Number</th>
                  <th className="p-3.5">Work Order</th>
                  <th className="p-3.5">Material</th>
                  <th className="p-3.5">Issued Qty</th>
                  <th className="p-3.5">Warehouse / Bin</th>
                  <th className="p-3.5">Issuer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {issues.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{i.issueNumber}</td>
                    <td className="p-3.5 font-medium text-slate-900">{i.workOrder?.woNumber}</td>
                    <td className="p-3.5 text-slate-700">
                      {i.material?.materialCode} - {i.material?.description}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {i.issuedQuantity} {i.uom?.uomCode}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {i.warehouse?.warehouseCode} {i.bin ? `/ ${i.bin.binCode}` : ''}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {i.issuer?.firstName} {i.issuer?.lastName}
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
            <h2 className="text-base font-bold text-slate-900">Post Material Issue</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Order ID *</label>
                <input
                  required
                  value={form.workOrderId}
                  onChange={(e) => setForm({ ...form, workOrderId: e.target.value })}
                  placeholder="Work Order ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Material ID *</label>
                <input
                  required
                  value={form.materialId}
                  onChange={(e) => setForm({ ...form, materialId: e.target.value })}
                  placeholder="Component Material ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issued Quantity *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.issuedQuantity}
                  onChange={(e) => setForm({ ...form, issuedQuantity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Warehouse ID *</label>
                <input
                  required
                  value={form.warehouseId}
                  onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                  placeholder="Warehouse ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Storage Bin ID (Optional)</label>
                <input
                  value={form.binId}
                  onChange={(e) => setForm({ ...form, binId: e.target.value })}
                  placeholder="Bin ID"
                  className="w-full px-3 py-2 border rounded-lg"
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
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
