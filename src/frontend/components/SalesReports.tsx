import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, RefreshCw, AlertCircle, TrendingUp, Users, FileText, ShoppingBag, AlertTriangle } from 'lucide-react';

export const SalesReports: React.FC = () => {
  const { token, activePlantId } = useAuth();

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const plantQuery = activePlantId ? `?plantId=${activePlantId}` : '';
      const res = await authFetch(`/api/v1/sales/reports/summary${plantQuery}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.data);
      } else {
        setError(data.error || 'Failed to fetch sales report summary');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching sales reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activePlantId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" /> Sales & Demand Executive Reports
          </h1>
          <p className="text-xs text-slate-500">Real-time database reporting for demand, sales orders, pending approvals, & shortages</p>
        </div>
        <button
          onClick={() => fetchData()}
          className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors self-start sm:self-auto"
          title="Refresh Report Data"
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

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          Loading executive sales report data...
        </div>
      ) : summary && (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Customers</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">{summary.totalCustomers}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Enquiries</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">{summary.totalEnquiries}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Quotations</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">{summary.totalQuotations}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Sales Orders</span>
                <ShoppingBag className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">{summary.totalOrders}</p>
            </div>
          </div>

          {/* Pending Approvals Table */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" /> Sales Orders Pending Maker-Checker Approval ({summary.pendingApprovalsCount})
            </h2>
            {summary.pendingApprovals.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No pending sales order approvals.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                      <th className="p-2.5">SO Number</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Quantity</th>
                      <th className="p-2.5">Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summary.pendingApprovals.map((o: any) => (
                      <tr key={o.id}>
                        <td className="p-2.5 font-mono font-medium text-blue-700">{o.soNumber}</td>
                        <td className="p-2.5 font-medium text-slate-800">{o.customer?.customerName}</td>
                        <td className="p-2.5 font-mono text-slate-600">{o.material?.materialCode}</td>
                        <td className="p-2.5 font-mono font-bold">{o.quantity}</td>
                        <td className="p-2.5 font-mono">₹{o.rate.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Production Requirements Table */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Pending Production Requirements from Shortages ({summary.pendingProductionRequirementsCount})
            </h2>
            {summary.pendingProductionRequirements.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No pending production shortages recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                      <th className="p-2.5">Req Number</th>
                      <th className="p-2.5">SO Ref</th>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Shortage Quantity</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summary.pendingProductionRequirements.map((r: any) => (
                      <tr key={r.id}>
                        <td className="p-2.5 font-mono font-medium text-amber-700">{r.requirementNumber}</td>
                        <td className="p-2.5 font-mono text-slate-600">{r.so?.soNumber}</td>
                        <td className="p-2.5 font-mono text-slate-600">{r.material?.materialCode}</td>
                        <td className="p-2.5 font-mono font-bold text-red-600">{r.requiredQuantity}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
