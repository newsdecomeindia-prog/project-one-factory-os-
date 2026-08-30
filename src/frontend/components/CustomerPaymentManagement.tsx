import React, { useState, useEffect } from 'react';

export const CustomerPaymentManagement: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');

  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reconcileAmount, setReconcileAmount] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resCust, resPay, resInv] = await Promise.all([
        fetch('/api/v1/customers', { headers }),
        fetch('/api/v1/finance/payments', { headers }),
        fetch('/api/v1/sales/invoices', { headers }),
      ]);

      const dataCust = await resCust.json();
      const dataPay = await resPay.json();
      const dataInv = await resInv.json();

      if (dataCust.success) setCustomers(dataCust.data);
      if (dataPay.success) setPayments(dataPay.data);
      if (dataInv.success) setInvoices(dataInv.data.filter((i: any) => i.paymentStatus !== 'PAID'));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          paymentAmount: Number(paymentAmount),
          paymentMethod,
          paymentReference,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `Payment Receipt ${data.data.paymentNumber} posted! GL Entry (DR Bank / CR AR) recorded.`,
        });
        setSelectedCustomerId('');
        setPaymentAmount('');
        setPaymentReference('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Payment posting failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/finance/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
          invoiceId: selectedInvoiceId,
          reconcileAmount: Number(reconcileAmount),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Payment successfully reconciled against Sales Invoice!' });
        setSelectedPaymentId('');
        setSelectedInvoiceId('');
        setReconcileAmount('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Reconciliation failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Customer Payments & Reconciliation</h2>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Post Payment */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Record Payment Receipt</h3>
          <form onSubmit={handlePostPayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                required
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customerCode} - {c.customerName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 1239000"
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              >
                <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference / UTR #</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="UTR / Cheque #"
                className="w-full border border-gray-300 rounded-md p-2"
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md">
              Post Payment Receipt
            </button>
          </form>
        </div>

        {/* Manual Reconciliation */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Manual Payment Reconciliation</h3>
          <form onSubmit={handleReconcile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Payment Receipt</label>
              <select
                value={selectedPaymentId}
                onChange={(e) => setSelectedPaymentId(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                required
              >
                <option value="">-- Select Payment --</option>
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.paymentNumber} - {p.customer?.customerName} (Unallocated: ₹{p.unallocatedAmount})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Sales Invoice</label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                required
              >
                <option value="">-- Select Invoice --</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} - Total: ₹{inv.totalAmount} (Status: {inv.paymentStatus})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reconcile Amount (₹)</label>
              <input
                type="number"
                value={reconcileAmount}
                onChange={(e) => setReconcileAmount(e.target.value)}
                placeholder="Amount to apply"
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-md">
              Reconcile Payment & Invoice
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 p-4 border-b">Payment Receipts</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unallocated</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-blue-600">{p.paymentNumber}</td>
                <td className="px-4 py-3 text-sm">{p.customer?.customerName}</td>
                <td className="px-4 py-3 text-sm font-bold">₹{p.paymentAmount}</td>
                <td className="px-4 py-3 text-sm font-semibold text-orange-600">₹{p.unallocatedAmount}</td>
                <td className="px-4 py-3 text-sm font-medium">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
