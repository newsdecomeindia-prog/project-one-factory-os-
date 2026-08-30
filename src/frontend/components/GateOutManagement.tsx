import React, { useState, useEffect } from 'react';

export const GateOutManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [passes, setPasses] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resInv, resPass] = await Promise.all([
        fetch('/api/v1/sales/invoices', { headers }),
        fetch('/api/v1/sales/gate-out', { headers }),
      ]);

      const dataInv = await resInv.json();
      const dataPass = await resPass.json();

      if (dataInv.success) setInvoices(dataInv.data.filter((i: any) => i.approvalStatus === 'APPROVED' && i.status !== 'COMPLETED'));
      if (dataPass.success) setPasses(dataPass.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleExecuteGateOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/sales/gate-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          vehicleNumber,
          driverName,
          driverPhone,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `Gate Out Pass ${data.data.gateOutNumber} executed! QA-accepted stock deducted & COGS (₹${data.data.cogsAmount}) posted.`,
        });
        setSelectedInvoiceId('');
        setVehicleNumber('');
        setDriverName('');
        setDriverPhone('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Gate Out execution failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Gate Out Pass & Physical Dispatch</h2>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Execute Physical Gate Out Pass</h3>
        <form onSubmit={handleExecuteGateOut} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approved Invoice</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
              required
            >
              <option value="">-- Select Approved Invoice --</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} - {inv.customer?.customerName} (Qty: {inv.quantity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. MH-12-AB-1234"
              className="w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Driver Name"
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone</label>
            <input
              type="text"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="+91 Mobile #"
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-4 flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-md">
              Authorize & Gate Out Goods
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 p-4 border-b">Executed Gate Out Passes</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gate Out #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">COGS Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {passes.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-emerald-600">{p.gateOutNumber}</td>
                <td className="px-4 py-3 text-sm">{p.invoice?.invoiceNumber}</td>
                <td className="px-4 py-3 text-sm">{p.vehicleNumber}</td>
                <td className="px-4 py-3 text-sm font-semibold">{p.quantity}</td>
                <td className="px-4 py-3 text-sm">₹{p.cogsAmount}</td>
                <td className="px-4 py-3 text-sm font-medium text-green-700">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
