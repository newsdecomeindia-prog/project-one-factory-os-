import React, { useState, useEffect } from 'react';

export const NcrManagement: React.FC = () => {
  const [ncrs, setNcrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Disposition State
  const [selectedNcrId, setSelectedNcrId] = useState<string | null>(null);
  const [disposition, setDisposition] = useState('SCRAP');
  const [dispositionReason, setDispositionReason] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const fetchNcrs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch('/api/v1/ncr', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNcrs(data.data);
      } else {
        setError(data.error || 'Failed to fetch NCR records');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNcrs();
  }, []);

  const handleDispositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNcrId) return;
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch(`/api/v1/ncr/${selectedNcrId}/disposition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          disposition,
          reason: dispositionReason,
          warehouseId: warehouseId || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`NCR ${data.data.ncrNumber} Disposition Executed: ${data.data.disposition}${data.data.reworkWoNumber ? ` (Rework WO Generated: ${data.data.reworkWoNumber})` : ''}`);
        setSelectedNcrId(null);
        setDispositionReason('');
        setWarehouseId('');
        fetchNcrs();
      } else {
        setError(data.error || 'Failed to execute disposition');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Non-Conformance & CAPA Management (NCR)</h1>
          <p className="text-sm text-gray-600">Track quality defects and execute disposition workflows (Scrap, Rework, Variance)</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
      {successMsg && <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">{successMsg}</div>}

      {selectedNcrId && (
        <div className="bg-white p-6 rounded-lg shadow border border-brand-300">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Execute Disposition for NCR</h2>
          <form onSubmit={handleDispositionSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Disposition Decision</label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="SCRAP">SCRAP (Deduct & Write-off Defective Stock)</option>
                <option value="REWORK">REWORK (Generate Rework Order Reference)</option>
                <option value="ACCEPT_WITH_VARIANCE">ACCEPT_WITH_VARIANCE (Accept with Quality Concession)</option>
              </select>
            </div>

            {disposition === 'SCRAP' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Warehouse ID for Stock Deduction (Optional)</label>
                <input
                  type="text"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
                  placeholder="e.g. UUID of Warehouse to write-off stock"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Mandatory Disposition Reason</label>
              <textarea
                required
                rows={3}
                value={dispositionReason}
                onChange={(e) => setDispositionReason(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
                placeholder="Provide detailed justification for disposition decision..."
              />
            </div>

            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setSelectedNcrId(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700"
              >
                Confirm Disposition Action
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Non-Conformance Reports</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading NCR records...</div>
        ) : ncrs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No Non-Conformance Reports recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NCR #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Defect Type / Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disposition</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approver</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ncrs.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-600">{row.ncrNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.material?.materialCode || row.materialId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.defectType} ({row.defectQuantity})</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {row.disposition}
                      {row.reworkWoNumber && <div className="text-xs text-blue-600 font-mono">Ref: {row.reworkWoNumber}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.approver?.email || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {row.status === 'OPEN' ? (
                        <button
                          onClick={() => { setSelectedNcrId(row.id); setSuccessMsg(''); setError(''); }}
                          className="text-brand-600 hover:text-brand-900 font-semibold"
                        >
                          Execute Disposition
                        </button>
                      ) : (
                        <span className="text-gray-400">Completed</span>
                      )}
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
