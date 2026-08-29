import React, { useState, useEffect } from 'react';

export const StockTransferManagement: React.FC = () => {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [sourcePlantId, setSourcePlantId] = useState('');
  const [targetPlantId, setTargetPlantId] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [uomId, setUomId] = useState('');

  // Cancel State
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch('/api/v1/stock-transfers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTransfers(data.data);
      } else {
        setError(data.error || 'Failed to fetch transfer orders');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch('/api/v1/stock-transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourcePlantId,
          targetPlantId,
          sourceWarehouseId,
          targetWarehouseId,
          materialId,
          transferQuantity: Number(transferQuantity),
          uomId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Stock Transfer Requisition Created: ${data.data.transferNumber}`);
        setSourcePlantId('');
        setTargetPlantId('');
        setSourceWarehouseId('');
        setTargetWarehouseId('');
        setMaterialId('');
        setTransferQuantity('');
        setUomId('');
        fetchTransfers();
      } else {
        setError(data.error || 'Failed to create transfer order');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApproveTransfer = async (id: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch(`/api/v1/stock-transfers/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transfer Order ${data.data.transferNumber} Approved`);
        fetchTransfers();
      } else {
        setError(data.error || 'Failed to approve transfer order');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleIssueTransfer = async (id: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch(`/api/v1/stock-transfers/${id}/issue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transfer Order ${data.data.transferNumber} Issued & Dispatched (IN_TRANSIT)`);
        fetchTransfers();
      } else {
        setError(data.error || 'Failed to issue transfer order');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReceiveTransfer = async (id: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch(`/api/v1/stock-transfers/${id}/receive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transfer Order ${data.data.transferNumber} Received & Stock Posted to Target Warehouse`);
        fetchTransfers();
      } else {
        setError(data.error || 'Failed to receive transfer order');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalId) return;
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('p1_token');
      const res = await fetch(`/api/v1/stock-transfers/${cancelModalId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transfer Order ${data.data.transferNumber} Cancelled`);
        setCancelModalId(null);
        setCancelReason('');
        fetchTransfers();
      } else {
        setError(data.error || 'Failed to cancel transfer order');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Internal Inventory Transfer Operations</h1>
          <p className="text-sm text-gray-600">Requisition, approval, issue/dispatch, receive, and cancel stock transfers</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
      {successMsg && <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">{successMsg}</div>}

      {cancelModalId && (
        <div className="bg-white p-6 rounded-lg shadow border border-red-300">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cancel Stock Transfer Order</h2>
          <form onSubmit={handleCancelSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mandatory Cancellation Reason</label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-red-500 focus:border-red-500"
                placeholder="Reason for cancelling stock transfer..."
              />
            </div>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setCancelModalId(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700"
              >
                Confirm Cancellation
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Create Stock Transfer Requisition</h2>
        <form onSubmit={handleCreateTransfer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Source Plant ID</label>
            <input
              type="text"
              required
              value={sourcePlantId}
              onChange={(e) => setSourcePlantId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of Source Plant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Target Plant ID</label>
            <input
              type="text"
              required
              value={targetPlantId}
              onChange={(e) => setTargetPlantId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of Target Plant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Source Warehouse ID</label>
            <input
              type="text"
              required
              value={sourceWarehouseId}
              onChange={(e) => setSourceWarehouseId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of Source Warehouse"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Target Warehouse ID</label>
            <input
              type="text"
              required
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of Target Warehouse"
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
            <label className="block text-sm font-medium text-gray-700">UOM ID</label>
            <input
              type="text"
              required
              value={uomId}
              onChange={(e) => setUomId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. UUID of UOM"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Transfer Quantity</label>
            <input
              type="number"
              required
              min="1"
              value={transferQuantity}
              onChange={(e) => setTransferQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700"
            >
              Request Stock Transfer
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Transfer Orders</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading transfer orders...</div>
        ) : transfers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No stock transfer orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transfer #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source -&gt; Target Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transfers.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-600">{row.transferNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.material?.materialCode || row.materialId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.sourceWarehouse?.warehouseCode} -&gt; {row.targetWarehouse?.warehouseCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.transferQuantity} {row.uom?.uomCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        row.status === 'COMPLETED' || row.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                        row.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                        row.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-800' :
                        row.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {row.status === 'REQUESTED' && (
                        <>
                          <button
                            onClick={() => handleApproveTransfer(row.id)}
                            className="text-indigo-600 hover:text-indigo-900 font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleIssueTransfer(row.id)}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            Issue
                          </button>
                        </>
                      )}
                      {row.status === 'APPROVED' && (
                        <button
                          onClick={() => handleIssueTransfer(row.id)}
                          className="text-blue-600 hover:text-blue-900 font-semibold"
                        >
                          Issue & Dispatch
                        </button>
                      )}
                      {row.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleReceiveTransfer(row.id)}
                          className="text-green-600 hover:text-green-900 font-semibold"
                        >
                          Receive Stock
                        </button>
                      )}
                      {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && (
                        <button
                          onClick={() => { setCancelModalId(row.id); setCancelReason(''); }}
                          className="text-red-600 hover:text-red-900 font-semibold"
                        >
                          Cancel
                        </button>
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
