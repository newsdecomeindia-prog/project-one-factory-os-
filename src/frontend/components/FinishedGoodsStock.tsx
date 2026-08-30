import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Boxes, RefreshCw, AlertCircle } from 'lucide-react';

export const FinishedGoodsStock: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const urlParams = activePlantId ? `?plantId=${activePlantId}` : '';
      const [dashRes, ledgerRes] = await Promise.all([
        fetch(`/api/v1/production-reports/dashboard${urlParams}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/v1/production-reports/stock-ledger${urlParams}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dashData = await dashRes.json();
      const ledgerData = await ledgerRes.json();

      if (dashData.success) setData(dashData.data);
      if (ledgerData.success) setLedger(ledgerData.data);
    } catch (err: any) {
      setError('Failed to fetch stock inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activePlantId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Finished Goods & Stock Balances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time inventory levels for Finished Goods and Raw Materials ledger.</p>
        </div>
        <button
          onClick={fetchData}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Inventory
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading stock balances...</div>
      ) : (
        <div className="space-y-6">
          {/* Stock Balances Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider">
              Current Available Stock Balances
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="p-3.5">Material Code</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Warehouse / Bin</th>
                    <th className="p-3.5 text-right">Available Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {data?.stockBalances?.map((sb: any) => (
                    <tr key={sb.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-semibold text-blue-700">{sb.material?.materialCode}</td>
                      <td className="p-3.5 font-medium text-slate-900">{sb.material?.description}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                            sb.material?.materialType === 'FINISHED_GOODS'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sb.material?.materialType}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {sb.warehouse?.warehouseCode} {sb.bin ? `/ ${sb.bin.binCode}` : ''}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900 text-sm">{sb.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Transaction Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider">
              Stock Transaction Audit Ledger
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="p-3.5">Transaction #</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Material</th>
                    <th className="p-3.5">Qty Change</th>
                    <th className="p-3.5">WO Reference</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {ledger.map((st: any) => (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-semibold text-slate-700">{st.transactionNumber}</td>
                      <td className="p-3.5 font-bold text-slate-700">{st.transactionType}</td>
                      <td className="p-3.5 font-medium text-slate-900">{st.material?.materialCode}</td>
                      <td className={`p-3.5 font-bold ${st.quantity >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {st.quantity >= 0 ? `+${st.quantity}` : st.quantity} {st.uom?.uomCode}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{st.referenceNumber || '-'}</td>
                      <td className="p-3.5 text-slate-600">{st.user?.firstName} {st.user?.lastName}</td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(st.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
