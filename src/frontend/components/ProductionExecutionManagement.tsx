import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, Plus, AlertCircle } from 'lucide-react';

export const ProductionExecutionManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    workOrderId: '',
    executedQuantity: 100,
    goodQuantity: 95,
    rejectedQuantity: 5,
    holdQuantity: 0,
    productionLine: 'LINE-1',
    remarks: 'Shift 1 Production Run',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = activePlantId ? `/api/v1/production-executions?plantId=${activePlantId}` : '/api/v1/production-executions';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setExecutions(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch production executions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activePlantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.executedQuantity !== form.goodQuantity + form.rejectedQuantity + form.holdQuantity) {
      alert(`Reconciliation error: Executed (${form.executedQuantity}) must equal Good (${form.goodQuantity}) + Rejected (${form.rejectedQuantity}) + Hold (${form.holdQuantity})`);
      return;
    }

    try {
      const res = await fetch('/api/v1/production-executions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Execution submission failed');

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
            <Settings className="w-5 h-5 text-blue-600" />
            Production Execution Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Record shift execution details and enforce quantity reconciliation (Executed = Good + Rejected + Hold).</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Record Execution Run
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading execution runs...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Execution Number</th>
                  <th className="p-3.5">Work Order</th>
                  <th className="p-3.5">Finished Product</th>
                  <th className="p-3.5">Executed Qty</th>
                  <th className="p-3.5">Good Qty</th>
                  <th className="p-3.5">Rejected Qty</th>
                  <th className="p-3.5">Hold Qty</th>
                  <th className="p-3.5">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {executions.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{e.executionNumber}</td>
                    <td className="p-3.5 font-medium text-slate-900">{e.workOrder?.woNumber}</td>
                    <td className="p-3.5 text-slate-700">
                      {e.finishedMaterial?.materialCode} - {e.finishedMaterial?.description}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{e.executedQuantity}</td>
                    <td className="p-3.5 font-bold text-emerald-700">{e.goodQuantity}</td>
                    <td className="p-3.5 font-bold text-red-700">{e.rejectedQuantity}</td>
                    <td className="p-3.5 font-bold text-amber-700">{e.holdQuantity}</td>
                    <td className="p-3.5 text-slate-600">
                      {e.operator?.firstName} {e.operator?.lastName}
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
            <h2 className="text-base font-bold text-slate-900">Record Production Run</h2>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Executed Total Qty *</label>
                  <input
                    required
                    type="number"
                    value={form.executedQuantity}
                    onChange={(e) => setForm({ ...form, executedQuantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-emerald-700 mb-1">Good Qty *</label>
                  <input
                    required
                    type="number"
                    value={form.goodQuantity}
                    onChange={(e) => setForm({ ...form, goodQuantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-emerald-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-red-700 mb-1">Rejected Qty</label>
                  <input
                    type="number"
                    value={form.rejectedQuantity}
                    onChange={(e) => setForm({ ...form, rejectedQuantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-red-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-amber-700 mb-1">Hold Qty</label>
                  <input
                    type="number"
                    value={form.holdQuantity}
                    onChange={(e) => setForm({ ...form, holdQuantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-amber-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Production Line</label>
                <input
                  value={form.productionLine}
                  onChange={(e) => setForm({ ...form, productionLine: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 font-mono">
                Reconciliation Check: {form.goodQuantity} + {form.rejectedQuantity} + {form.holdQuantity} = {form.goodQuantity + form.rejectedQuantity + form.holdQuantity} / {form.executedQuantity} Executed
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
                  Record Execution Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
