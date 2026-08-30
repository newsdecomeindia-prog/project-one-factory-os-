import React, { useState, useEffect } from 'react';

export const IpqcManagement: React.FC = () => {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [workOrderId, setWorkOrderId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [uomId, setUomId] = useState('');
  const [inspectedQuantity, setInspectedQuantity] = useState('');
  const [passedQuantity, setPassedQuantity] = useState('');
  const [failedQuantity, setFailedQuantity] = useState('');
  const [remarks, setRemarks] = useState('');

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch('/api/v1/ipqc', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setInspections(data.data);
      } else {
        setError(data.error || 'Failed to fetch IPQC records');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch('/api/v1/ipqc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workOrderId: workOrderId || undefined,
          materialId,
          uomId: uomId || undefined,
          inspectedQuantity: Number(inspectedQuantity),
          passedQuantity: Number(passedQuantity),
          failedQuantity: Number(failedQuantity || 0),
          remarks,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`IPQC Record Created: ${data.data.inspectionNumber}${data.ncr ? ` (NCR Generated: ${data.ncr.ncrNumber})` : ''}`);
        setWorkOrderId('');
        setMaterialId('');
        setUomId('');
        setInspectedQuantity('');
        setPassedQuantity('');
        setFailedQuantity('');
        setRemarks('');
        fetchInspections();
      } else {
        setError(data.error || 'Failed to submit IPQC inspection');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">In-Process Quality Control (IPQC)</h1>
          <p className="text-sm text-gray-600">Mid-production quality sampling, defect logging, and automatic NCR triggers</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
      {successMsg && <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">{successMsg}</div>}

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Record New In-Process Quality Log</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Work Order ID (Optional)</label>
            <input
              type="text"
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of Work Order"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Material ID</label>
            <input
              type="text"
              required
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of Material"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">UOM ID (Optional)</label>
            <input
              type="text"
              value={uomId}
              onChange={(e) => setUomId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of UOM"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Inspected Quantity</label>
            <input
              type="number"
              required
              min="1"
              value={inspectedQuantity}
              onChange={(e) => setInspectedQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Passed Quantity</label>
            <input
              type="number"
              required
              min="0"
              value={passedQuantity}
              onChange={(e) => setPassedQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Failed Quantity (Defect Qty)</label>
            <input
              type="number"
              min="0"
              value={failedQuantity}
              onChange={(e) => setFailedQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Remarks / Quality Log Notes</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="Optional inspection notes"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Submit IPQC Inspection
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Inspection History</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading IPQC history...</div>
        ) : inspections.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No In-Process Quality Inspections recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspection #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspected / Passed / Failed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspector</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inspections.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-600">{row.inspectionNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.workOrder?.woNumber || row.workOrderId || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.material?.materialCode || row.materialId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.inspectedQuantity} / {row.passedQuantity} / {row.failedQuantity} {row.uom?.uomCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.status === 'PASSED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.inspector?.email || row.inspectorId}</td>
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
