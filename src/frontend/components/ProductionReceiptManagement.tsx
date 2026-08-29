import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PackagePlus, Plus, AlertCircle } from 'lucide-react';

export const ProductionReceiptManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    executionId: '',
    warehouseId: '',
    binId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = activePlantId ? `/api/v1/production-receipts?plantId=${activePlantId}` : '/api/v1/production-receipts';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setReceipts(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch production receipts');
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
      const res = await fetch('/api/v1/production-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Production receipt creation failed');

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
            <PackagePlus className="w-5 h-5 text-blue-600" />
            Production Receipt Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Post verified good production into FG Stock (Rejected & Hold quantities excluded from available inventory).</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Post FG Production Receipt
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading production receipts...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Receipt Number</th>
                  <th className="p-3.5">Work Order</th>
                  <th className="p-3.5">Execution Run</th>
                  <th className="p-3.5">Finished Material</th>
                  <th className="p-3.5">Good Qty Received</th>
                  <th className="p-3.5">Rejected Excluded</th>
                  <th className="p-3.5">Warehouse / Bin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{r.receiptNumber}</td>
                    <td className="p-3.5 font-medium text-slate-900">{r.workOrder?.woNumber}</td>
                    <td className="p-3.5 text-slate-600">{r.execution?.executionNumber}</td>
                    <td className="p-3.5 font-medium text-slate-900">
                      {r.finishedMaterial?.materialCode} - {r.finishedMaterial?.description}
                    </td>
                    <td className="p-3.5 font-bold text-emerald-700">+{r.receivedQuantity} {r.uom?.uomCode}</td>
                    <td className="p-3.5 font-bold text-red-700">{r.rejectedQuantity}</td>
                    <td className="p-3.5 text-slate-600">
                      {r.warehouse?.warehouseCode} {r.bin ? `/ ${r.bin.binCode}` : ''}
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
            <h2 className="text-base font-bold text-slate-900">Post FG Production Receipt</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Execution Run ID *</label>
                <input
                  required
                  value={form.executionId}
                  onChange={(e) => setForm({ ...form, executionId: e.target.value })}
                  placeholder="Production Execution Run ID"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Warehouse ID *</label>
                <input
                  required
                  value={form.warehouseId}
                  onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                  placeholder="Warehouse ID for FG Stock"
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
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
                Note: Standard manufacturing rule applies — ONLY Good Quantity will be posted to Available FG Stock.
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
                  Post to FG Available Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
