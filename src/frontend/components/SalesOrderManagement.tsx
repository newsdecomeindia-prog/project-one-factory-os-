import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, Plus, RefreshCw, AlertCircle, CheckCircle, PackageCheck } from 'lucide-react';

interface SalesOrder {
  id: string;
  soNumber: string;
  quantity: number;
  rate: number;
  taxPercent: number;
  status: string;
  approvalStatus: string;
  requiredDeliveryDate: string;
  customer: { customerCode: string; customerName: string };
  quotation?: { quotationNumber: string };
  material: { materialCode: string; description: string };
  createdBy: { firstName: string; lastName: string };
  approver?: { firstName: string; lastName: string };
}

export const SalesOrderManagement: React.FC = () => {
  const { token, activePlantId, user } = useAuth();

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    quotationId: '',
    materialId: '',
    quantity: '1000',
    rate: '250',
    taxPercent: '18',
    requiredDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    shippingLocation: 'Customer Dock 1',
    paymentTerms: 'NET 30',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const plantQuery = activePlantId ? `?plantId=${activePlantId}` : '';
      const [resSo, resCust, resQtn, resMat] = await Promise.all([
        authFetch(`/api/v1/sales/orders${plantQuery}`),
        authFetch('/api/v1/customers'),
        authFetch(`/api/v1/sales/quotations${plantQuery}`),
        authFetch('/api/v1/foundation/materials'),
      ]);

      const [dataSo, dataCust, dataQtn, dataMat] = await Promise.all([
        resSo.json(),
        resCust.json(),
        resQtn.json(),
        resMat.json(),
      ]);

      if (dataSo.success) setOrders(dataSo.data);
      if (dataCust.success) setCustomers(dataCust.data);
      if (dataQtn.success) setQuotations(dataQtn.data);
      if (dataMat.success) setMaterials(dataMat.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales orders');
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
      const res = await authFetch('/api/v1/sales/orders', {
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
        setSuccessMsg(`Sales Order ${data.data.soNumber} created successfully!`);
        fetchData();
      } else {
        setError(data.error || 'Failed to create sales order');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating sales order');
    }
  };

  const handleApprove = async (soId: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await authFetch(`/api/v1/sales/orders/${soId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Approved by authorized manager' }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Sales Order approved successfully!`);
        fetchData();
      } else {
        setError(data.error || 'Approval failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error approving sales order');
    }
  };

  const handleCheckAvailability = async (soId: string) => {
    setError(null);
    try {
      const res = await authFetch(`/api/v1/sales/orders/${soId}/check-availability`);
      const data = await res.json();
      if (data.success) {
        setAvailabilityResult(data.data);
      } else {
        setError(data.error || 'FG Availability check failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error checking availability');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" /> Sales Orders
          </h1>
          <p className="text-xs text-slate-500">Sales order creation, Maker-Checker approval, & FG availability check</p>
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
            <span>New Sales Order</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* FG Availability Result Card */}
      {availabilityResult && (
        <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-blue-900">
            <span className="flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-blue-600" />
              FG Stock Availability Check — {availabilityResult.soNumber}
            </span>
            <button
              onClick={() => setAvailabilityResult(null)}
              className="text-slate-400 hover:text-slate-600 font-normal"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-blue-100 font-mono text-slate-800">
            <div>
              <p className="text-[10px] text-slate-500 font-sans">SO Quantity</p>
              <p className="font-bold text-slate-900">{availabilityResult.orderedQuantity} units</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-sans">Actual FG Stock (DB)</p>
              <p className="font-bold text-blue-600">{availabilityResult.availableStock} units</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-sans">Fulfillable Qty</p>
              <p className="font-bold text-emerald-600">{availabilityResult.fulfillableQuantity} units</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-sans">Shortage Quantity</p>
              <p className={`font-bold ${availabilityResult.shortageQuantity > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                {availabilityResult.shortageQuantity} units
              </p>
            </div>
          </div>
          {availabilityResult.productionRequirementCreated && (
            <p className="text-[11px] text-amber-800 font-medium">
              ⚡ Shortage Detected: Production Requirement{' '}
              <span className="font-mono font-bold">{availabilityResult.productionRequirement?.requirementNumber}</span> automatically created for {availabilityResult.productionRequirementQuantity} units.
            </p>
          )}
        </div>
      )}

      {/* Sales Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading sales orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No sales orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  <th className="p-3">SO Number</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Rate (₹)</th>
                  <th className="p-3">Approval Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((so) => (
                  <tr key={so.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-700">{so.soNumber}</td>
                    <td className="p-3 font-medium text-slate-800">{so.customer?.customerName}</td>
                    <td className="p-3 text-slate-600 font-mono">{so.material?.materialCode}</td>
                    <td className="p-3 font-mono font-bold">{so.quantity}</td>
                    <td className="p-3 font-mono">₹{so.rate.toLocaleString()}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          so.approvalStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {so.approvalStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {so.approvalStatus === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(so.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleCheckAvailability(so.id)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold hover:bg-blue-100"
                      >
                        Check FG
                      </button>
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
            <h2 className="text-base font-bold text-slate-900">Create Sales Order</h2>
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
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Quotation Reference (Optional)</label>
                <select
                  value={formData.quotationId}
                  onChange={(e) => {
                    const qtn = quotations.find((x) => x.id === e.target.value);
                    setFormData({
                      ...formData,
                      quotationId: e.target.value,
                      ...(qtn ? { customerId: qtn.customerId, materialId: qtn.materialId, quantity: String(qtn.quantity), rate: String(qtn.rate) } : {}),
                    });
                  }}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Direct Sales Order (No Quotation)</option>
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.quotationNumber} — {q.customer?.customerName} (₹{q.rate}/unit)
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
                  Create Sales Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
