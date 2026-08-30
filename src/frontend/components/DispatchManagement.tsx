import React, { useState, useEffect } from 'react';

export const DispatchManagement: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [dispatchQty, setDispatchQuantity] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resPlans, resDisp] = await Promise.all([
        fetch('/api/v1/sales/delivery-plans', { headers }),
        fetch('/api/v1/sales/dispatches', { headers }),
      ]);

      const dataPlans = await resPlans.json();
      const dataDisp = await resDisp.json();

      if (dataPlans.success) setPlans(dataPlans.data);
      if (dataDisp.success) setDispatches(dataDisp.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/sales/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deliveryPlanId: selectedPlanId, dispatchQuantity: Number(dispatchQty) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Dispatch Note generated: ${data.data.dispatchNumber}` });
        setSelectedPlanId('');
        setDispatchQuantity('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate dispatch note' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dispatch Advice Management</h2>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-error-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Generate Dispatch Note</h3>
        <form onSubmit={handleCreateDispatch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Delivery Plan</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
              required
            >
              <option value="">-- Select Delivery Plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.planNumber} - {p.material?.description || 'Item'} (Planned: {p.plannedQuantity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dispatch Quantity</label>
            <input
              type="number"
              value={dispatchQty}
              onChange={(e) => setDispatchQuantity(e.target.value)}
              placeholder="e.g. 700"
              className="w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>

          <div className="flex items-end">
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md">
              Issue Dispatch Note
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 p-4 border-b">Issued Dispatch Notes</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery Plan #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QA Gate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dispatches.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-blue-600">{d.dispatchNumber}</td>
                <td className="px-4 py-3 text-sm">{d.deliveryPlan?.planNumber}</td>
                <td className="px-4 py-3 text-sm">{d.material?.description}</td>
                <td className="px-4 py-3 text-sm font-semibold">{d.dispatchQuantity}</td>
                <td className="px-4 py-3 text-sm text-green-600 font-medium">{d.qcStatus}</td>
                <td className="px-4 py-3 text-sm">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
