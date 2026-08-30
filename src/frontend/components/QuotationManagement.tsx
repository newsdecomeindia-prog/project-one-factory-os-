import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileCheck, Plus, RefreshCw, AlertCircle } from 'lucide-react';

interface SalesQuotation {
  id: string;
  quotationNumber: string;
  quantity: number;
  rate: number;
  taxPercent: number;
  paymentTerms?: string;
  status: string;
  customer: { customerCode: string; customerName: string };
  enquiry?: { enquiryNumber: string };
  material: { materialCode: string; description: string };
}

export const QuotationManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const [quotations, setQuotations] = useState<SalesQuotation[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    enquiryId: '',
    materialId: '',
    quantity: '1000',
    rate: '250',
    taxPercent: '18',
    paymentTerms: 'NET 30',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const plantQuery = activePlantId ? `?plantId=${activePlantId}` : '';
      const [resQtn, resCust, resEnq, resMat] = await Promise.all([
        authFetch(`/api/v1/sales/quotations${plantQuery}`),
        authFetch('/api/v1/customers'),
        authFetch(`/api/v1/sales/enquiries${plantQuery}`),
        authFetch('/api/v1/foundation/materials'),
      ]);

      const [dataQtn, dataCust, dataEnq, dataMat] = await Promise.all([
        resQtn.json(),
        resCust.json(),
        resEnq.json(),
        resMat.json(),
      ]);

      if (dataQtn.success) setQuotations(dataQtn.data);
      if (dataCust.success) setCustomers(dataCust.data);
      if (dataEnq.success) setEnquiries(dataEnq.data.filter((e: any) => e.status === 'SUBMITTED'));
      if (dataMat.success) setMaterials(dataMat.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activePlantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlantId) {
      setError('Please select an active plant scope first');
      return;
    }

    try {
      const res = await authFetch('/api/v1/sales/quotations', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          plantId: activePlantId,
          quantity: parseFloat(formData.quantity),
          rate: parseFloat(formData.rate),
          taxPercent: parseFloat(formData.taxPercent),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        fetchData();
      } else {
        setError(data.error || 'Failed to create sales quotation');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating sales quotation');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-blue-600" /> Sales Quotations
          </h1>
          <p className="text-xs text-slate-500">Commercial pricing, tax rates, & payment terms quotes</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchData()}
            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quotations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No sales quotations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Quotation Number</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Enquiry Ref</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Rate (₹)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-700">{q.quotationNumber}</td>
                    <td className="p-3 font-medium text-slate-800">{q.customer?.customerName}</td>
                    <td className="p-3 text-slate-600 font-mono">{q.enquiry?.enquiryNumber || 'Direct Quote'}</td>
                    <td className="p-3 text-slate-600 font-mono">{q.material?.materialCode}</td>
                    <td className="p-3 font-mono font-bold">{q.quantity}</td>
                    <td className="p-3 font-mono">₹{q.rate.toLocaleString()}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Create Sales Quotation</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customerCode} - {c.customerName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Enquiry Reference (Optional)</label>
                <select
                  value={formData.enquiryId}
                  onChange={(e) => {
                    const enq = enquiries.find((x) => x.id === e.target.value);
                    setFormData({
                      ...formData,
                      enquiryId: e.target.value,
                      ...(enq ? { customerId: enq.customerId, materialId: enq.materialId, quantity: String(enq.quantity) } : {}),
                    });
                  }}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Direct Quote (No Enquiry Link)</option>
                  {enquiries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.enquiryNumber} — {e.customer?.customerName} ({e.quantity} units)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Material / Product *</label>
                <select
                  required
                  value={formData.materialId}
                  onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Material...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialCode} - {m.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                >
                  Create Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
