import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, RefreshCw, AlertCircle, Ban } from 'lucide-react';

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  address?: string;
  gstin?: string;
  contact?: string;
  shippingLocation?: string;
  paymentTerms?: string;
  creditLimit?: number;
  status: string;
}

export const CustomerManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const [formData, setFormData] = useState({
    customerCode: '',
    customerName: '',
    address: '',
    gstin: '',
    contact: '',
    shippingLocation: '',
    paymentTerms: 'NET 30',
    creditLimit: '500000',
  });

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      } else {
        setError(data.error || 'Failed to fetch customers');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [activePlantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          creditLimit: parseFloat(formData.creditLimit) || 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData({
          customerCode: '',
          customerName: '',
          address: '',
          gstin: '',
          contact: '',
          shippingLocation: '',
          paymentTerms: 'NET 30',
          creditLimit: '500000',
        });
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to create customer');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating customer');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId || !deactivateReason.trim()) {
      setError('A valid reason is required for deactivation');
      return;
    }

    try {
      const res = await authFetch(`/api/v1/customers/${deactivateId}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason: deactivateReason }),
      });

      const data = await res.json();
      if (data.success) {
        setDeactivateId(null);
        setDeactivateReason('');
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to deactivate customer');
      }
    } catch (err: any) {
      setError(err.message || 'Error deactivating customer');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Customer Master
          </h1>
          <p className="text-xs text-slate-500">Manage company-isolated customers, credit limits, & GST details</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchCustomers()}
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
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customer List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Code</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3">Payment Terms</th>
                  <th className="p-3">Credit Limit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-700">{c.customerCode}</td>
                    <td className="p-3 font-medium text-slate-900">{c.customerName}</td>
                    <td className="p-3 text-slate-600 font-mono">{c.gstin || 'N/A'}</td>
                    <td className="p-3 text-slate-600">{c.paymentTerms || 'NET 30'}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      ₹{c.creditLimit?.toLocaleString() || '0'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {c.status === 'ACTIVE' && (
                        <button
                          onClick={() => setDeactivateId(c.id)}
                          className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] font-medium transition-colors"
                        >
                          Deactivate
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Add New Customer</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Customer Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="CUST-001"
                    value={formData.customerCode}
                    onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Global Corp"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
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
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {deactivateId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" /> Deactivate Customer
            </h2>
            <p className="text-xs text-slate-600">
              No destructive deletion permitted. Please provide a mandatory reason for deactivating this customer record.
            </p>
            <textarea
              required
              rows={3}
              placeholder="Mandatory reason for deactivation..."
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-red-500"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeactivateId(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
