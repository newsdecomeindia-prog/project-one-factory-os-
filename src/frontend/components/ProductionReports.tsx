import React, { useState, useEffect } from 'react';

export const ProductionReports: React.FC = () => {
  const [reportType, setReportType] = useState('ipqc');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async (type: string) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('p1_token');
      const endpoint = type === 'dashboard' ? '/api/v1/production-reports/dashboard' :
                       type === 'ledger' ? '/api/v1/production-reports/stock-ledger' :
                       `/api/v1/production-reports/${type}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch report data');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(reportType);
  }, [reportType]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Operational & Quality Reports</h1>
          <p className="text-sm text-gray-600">Real-time reporting on IPQC, NCR/CAPA, Stock Transfers, and Inventory Ledger</p>
        </div>

        <div className="flex space-x-2">
          {['ipqc', 'ncr', 'transfers', 'dashboard', 'ledger'].map((t) => (
            <button
              key={t}
              onClick={() => setReportType(t)}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase ${
                reportType === t ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="p-6 text-center text-gray-500">Loading real-time report data...</div>
      ) : data ? (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-6">
          <h2 className="text-lg font-bold text-gray-800 capitalize">{reportType} Analytics Summary</h2>
          <pre className="bg-gray-50 p-4 rounded text-xs overflow-x-auto border font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
};
