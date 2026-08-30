import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Truck, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DeliveryPlan {
  id: string;
  planNumber: string;
  availableQuantity: number;
  plannedDeliveryQuantity: number;
  pendingQuantity: number;
  requiredDeliveryDate: string;
  status: string;
  customer: { customerCode: string; customerName: string };
  so: { soNumber: string; quantity: number };
  material: { materialCode: string; description: string };
}

export const DeliveryPlanningManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const [plans, setPlans] = useState<DeliveryPlan[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedSoId, setSelectedSoId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const plantQuery = activePlantId ? `?plantId=${activePlantId}` : '';
      const [resPlan, resSo] = await Promise.all([
        authFetch(`/api/v1/sales/delivery-plans${plantQuery}`),
        authFetch(`/api/v1/sales/orders${plantQuery}`),
      ]);

      const [dataPlan, dataSo] = await Promise.all([resPlan.json(), resSo.json()]);

      if (dataPlan.success) setPlans(dataPlan.data);
      if (dataSo.success) setOrders(dataSo.data.filter((o: any) => o.approvalStatus === 'APPROVED'));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch delivery plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activePlantId]);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSoId) return;

    setError(null);
    setSuccessMsg(null);
    try {
      const res = await authFetch('/api/v1/sales/delivery-plans', {
        method: 'POST',
        body: JSON.stringify({ soId: selectedSoId }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Delivery Plan ${data.data.planNumber} generated successfully!`);
        setSelectedSoId('');
        fetchData();
      } else {
        setError(data.error || 'Failed to generate delivery plan');
      }
    } catch (err: any) {
      setError(err.message || 'Error generating delivery plan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" /> Delivery Planning & Requirements
          </h1>
          <p className="text-xs text-slate-500">Dispatch requirement planning based on actual FG available stock</p>
        </div>
        <button
          onClick={() => fetchData()}
          className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors self-start sm:self-auto"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Plan Generation Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Generate Delivery Plan for Approved Sales Order</h2>
        <form onSubmit={handleGeneratePlan} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Approved Sales Order *</label>
            <select
              required
              value={selectedSoId}
              onChange={(e) => setSelectedSoId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select Approved Sales Order...</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.soNumber} — {o.customer?.customerName} ({o.quantity} units {o.material?.materialCode})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!selectedSoId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm"
          >
            Generate Requirement Plan
          </button>
        </form>
      </div>

      {/* Delivery Plans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading delivery plans...</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No delivery plans recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Plan Number</th>
                  <th className="p-3">SO Ref</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Available FG</th>
                  <th className="p-3">Planned Delivery</th>
                  <th className="p-3">Pending Shortage</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-700">{p.planNumber}</td>
                    <td className="p-3 font-mono text-slate-600">{p.so?.soNumber}</td>
                    <td className="p-3 font-medium text-slate-800">{p.customer?.customerName}</td>
                    <td className="p-3 font-mono text-slate-600">{p.material?.materialCode}</td>
                    <td className="p-3 font-mono text-blue-600 font-semibold">{p.availableQuantity}</td>
                    <td className="p-3 font-mono text-emerald-600 font-bold">{p.plannedDeliveryQuantity}</td>
                    <td className="p-3 font-mono text-amber-600 font-bold">{p.pendingQuantity}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
