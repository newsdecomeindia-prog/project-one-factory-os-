import React, { useState, useEffect } from 'react';

export const SalesInvoiceManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [selectedDispatchId, setSelectedDispatchId] = useState('');
  const [selectedTaxCode, setSelectedTaxCode] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resInv, resDisp, resTax] = await Promise.all([
        fetch('/api/v1/sales/invoices', { headers }),
        fetch('/api/v1/sales/dispatches', { headers }),
        fetch('/api/v1/finance/tax-masters', { headers }),
      ]);

      const dataInv = await resInv.json();
      const dataDisp = await resDisp.json();
      const dataTax = await resTax.json();

      if (dataInv.success) setInvoices(dataInv.data);
      if (dataDisp.success) setDispatches(dataDisp.data.filter((d: any) => d.status === 'ISSUED'));
      if (dataTax.success) setTaxes(dataTax.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/sales/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dispatchId: selectedDispatchId, taxCode: selectedTaxCode || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Sales Invoice created: ${data.data.invoiceNumber} (Total: ₹${data.data.totalAmount})` });
        setSelectedDispatchId('');
        setSelectedTaxCode('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate invoice' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/sales/invoices/${invoiceId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Invoice ${data.data.invoiceNumber} approved & GL Journal posted!` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Invoice approval failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!cancelReason) {
      setMessage({ type: 'error', text: 'Please enter a cancellation reason' });
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/sales/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Invoice ${data.data.invoiceNumber} cancelled & GL reversed.` });
        setCancellingInvoiceId(null);
        setCancelReason('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Invoice cancellation failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Sales Invoicing & Tax Management</h2>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Generate Sales Invoice</h3>
        <form onSubmit={handleGenerateInvoice} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Dispatch Advice</label>
            <select
              value={selectedDispatchId}
              onChange={(e) => setSelectedDispatchId(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
              required
            >
              <option value="">-- Select Dispatch --</option>
              {dispatches.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dispatchNumber} - {d.material?.description} (Qty: {d.dispatchQuantity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Slab / GST Master</label>
            <select
              value={selectedTaxCode}
              onChange={(e) => setSelectedTaxCode(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
            >
              <option value="">-- Default / Auto GST --</option>
              {taxes.map((t) => (
                <option key={t.id} value={t.taxCode}>
                  {t.taxCode} - {t.taxName} ({t.taxRate}%)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md">
              Generate Sales Invoice
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 p-4 border-b">Sales Invoices</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-4 py-3 font-medium text-indigo-600">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-sm">{inv.customer?.customerName}</td>
                <td className="px-4 py-3 text-sm">₹{inv.subtotalAmount}</td>
                <td className="px-4 py-3 text-sm">₹{inv.taxAmount} ({inv.taxRate}%)</td>
                <td className="px-4 py-3 text-sm font-bold">₹{inv.totalAmount}</td>
                <td className="px-4 py-3 text-sm font-semibold">{inv.approvalStatus}</td>
                <td className="px-4 py-3 text-sm space-x-2">
                  {inv.approvalStatus === 'PENDING' && (
                    <button
                      onClick={() => handleApproveInvoice(inv.id)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3 rounded"
                    >
                      Approve
                    </button>
                  )}
                  {inv.status !== 'CANCELLED' && inv.status !== 'COMPLETED' && (
                    <button
                      onClick={() => setCancellingInvoiceId(inv.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-3 rounded"
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

      {cancellingInvoiceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Cancel Invoice</h3>
            <p className="text-sm text-gray-600">Provide a reason for invoice cancellation and GL reversal:</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm"
              placeholder="e.g. Order detail discrepancy before Gate Out"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setCancellingInvoiceId(null)} className="px-4 py-2 border rounded text-gray-600">
                Back
              </button>
              <button
                onClick={() => handleCancelInvoice(cancellingInvoiceId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm Cancel & Reverse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
