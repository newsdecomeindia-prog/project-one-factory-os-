import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Plus, AlertCircle, Play, XCircle } from 'lucide-react';

export const WorkOrderManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plantId: activePlantId || '',
    departmentId: '',
    finishedMaterialId: '',
    bomHeaderId: '',
    plannedQuantity: 100,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = activePlantId ? `/api/v1/work-orders?plantId=${activePlantId}` : '/api/v1/work-orders';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setWorkOrders(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch work orders');
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
      const res = await fetch('/api/v1/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create work order');

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRelease = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${id}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to release work order');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCancelModal) return;
    try {
      const res = await fetch(`/api/v1/work-orders/${showCancelModal}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancelReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Cancellation failed');

      setShowCancelModal(null);
      setCancelReason('');
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
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Work Order Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create, release, reserve materials, and track factory work orders.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Work Order
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading work orders...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">WO Number</th>
                  <th className="p-3.5">Finished Product</th>
                  <th className="p-3.5">Planned Qty</th>
                  <th className="p-3.5">Plant / Dept</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {workOrders.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{w.woNumber}</td>
                    <td className="p-3.5 font-medium text-slate-900">
                      {w.finishedMaterial?.materialCode} - {w.finishedMaterial?.description}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {w.plannedQuantity} {w.uom?.uomCode}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {w.plant?.plantCode} / {w.department?.departmentCode}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          w.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : w.status === 'MATERIAL_RESERVED' || w.status === 'RELEASED'
                            ? 'bg-blue-100 text-blue-800'
                            : w.status === 'IN_PROCESS'
                            ? 'bg-indigo-100 text-indigo-800'
                            : w.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {w.status === 'DRAFT' && (
                        <button
                          onClick={() => handleRelease(w.id)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" /> Release & Reserve
                        </button>
                      )}
                      {w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && (
                        <button
                          onClick={() => setShowCancelModal(w.id)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-medium rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Cancel
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
            <h2 className="text-base font-bold text-slate-900">Create Work Order</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant ID *</label>
                <input
                  required
                  value={form.plantId}
                  onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                  placeholder="Plant ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department ID *</label>
                <input
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  placeholder="Department ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Finished Product Material ID *</label>
                <input
                  required
                  value={form.finishedMaterialId}
                  onChange={(e) => setForm({ ...form, finishedMaterialId: e.target.value })}
                  placeholder="Finished Material ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">BOM Header ID *</label>
                <input
                  required
                  value={form.bomHeaderId}
                  onChange={(e) => setForm({ ...form, bomHeaderId: e.target.value })}
                  placeholder="Active BOM Header ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Planned Quantity *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.plannedQuantity}
                  onChange={(e) => setForm({ ...form, plannedQuantity: parseFloat(e.target.value) })}
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
                  Create Draft WO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Cancel Work Order</h2>
            <form onSubmit={handleCancel} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mandatory Cancellation Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why this work order is being cancelled..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold">
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
