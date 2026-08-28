import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, TrendingUp, CheckCircle2, AlertOctagon, PackageMinus } from 'lucide-react';

export const ProductionReports: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const urlParams = activePlantId ? `?plantId=${activePlantId}` : '';
      const res = await fetch(`/api/v1/production-reports/dashboard${urlParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashData = await res.json();
      if (dashData.success) setData(dashData.data);
      else setError(dashData.error);
    } catch (err: any) {
      setError('Failed to fetch production report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activePlantId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Production & Golden Flow Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Real-time metrics derived directly from production execution and receipt transactions.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading analytics...</div>
      ) : (
        <div className="space-y-6">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Total Executed Qty</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{data?.totalExecuted?.executed || 0}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Good FG Received</p>
                <h3 className="text-2xl font-black text-emerald-700 mt-1">{data?.totalReceipts?.receivedFG || 0}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Rejected Quantity</p>
                <h3 className="text-2xl font-black text-red-700 mt-1">{data?.totalExecuted?.rejected || 0}</h3>
              </div>
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <AlertOctagon className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Raw Material Issued</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{data?.totalIssued?.quantity || 0}</h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <PackageMinus className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Work Order Status Breakdown */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Work Order Status Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data?.workOrderStats?.map((s: any) => (
                <div key={s.status} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{s.status}</span>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{s._count._all} Orders</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
