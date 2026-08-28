import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layers, Plus, AlertCircle, FileText } from 'lucide-react';

export const BomManagement: React.FC = () => {
  const { token, activePlantId } = useAuth();
  const [boms, setBoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    finishedMaterialId: '',
    plantId: activePlantId || '',
    components: [{ componentMaterialId: '', quantityPerUnit: 1, scrapFactor: 0 }],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = activePlantId ? `/api/v1/boms?plantId=${activePlantId}` : '/api/v1/boms';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setBoms(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch BOMs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activePlantId]);

  const handleAddComponentRow = () => {
    setForm({
      ...form,
      components: [...form.components, { componentMaterialId: '', quantityPerUnit: 1, scrapFactor: 0 }],
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/boms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create BOM');

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Bill of Materials (BOM) Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Define multi-level BOM structures, versioning, and scrap factors.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create BOM
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading BOM records...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">BOM Number</th>
                  <th className="p-3.5">Finished Product</th>
                  <th className="p-3.5">Plant</th>
                  <th className="p-3.5">Version</th>
                  <th className="p-3.5">Components Count</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {boms.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-blue-700">{b.bomNumber}</td>
                    <td className="p-3.5 font-medium text-slate-900">
                      {b.finishedMaterial?.materialCode} - {b.finishedMaterial?.description}
                    </td>
                    <td className="p-3.5 text-slate-600">{b.plant?.plantName}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-700">v{b.version}</td>
                    <td className="p-3.5 text-slate-600">{b.components?.length || 0} items</td>
                    <td className="p-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Create New Bill of Materials</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Finished Product Material ID *</label>
                <input
                  required
                  value={form.finishedMaterialId}
                  onChange={(e) => setForm({ ...form, finishedMaterialId: e.target.value })}
                  placeholder="Paste FG Material ID (e.g. from seed or material list)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plant ID *</label>
                <input
                  required
                  value={form.plantId}
                  onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                  placeholder="Plant ID"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">Components</label>
                {form.components.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      required
                      placeholder="Component Material ID"
                      value={c.componentMaterialId}
                      onChange={(e) => {
                        const newComps = [...form.components];
                        newComps[idx].componentMaterialId = e.target.value;
                        setForm({ ...form, components: newComps });
                      }}
                      className="flex-1 px-3 py-1.5 border rounded-lg"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Qty/Unit"
                      value={c.quantityPerUnit}
                      onChange={(e) => {
                        const newComps = [...form.components];
                        newComps[idx].quantityPerUnit = parseFloat(e.target.value);
                        setForm({ ...form, components: newComps });
                      }}
                      className="w-24 px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddComponentRow}
                  className="text-blue-600 font-semibold text-[11px] hover:underline"
                >
                  + Add Component Row
                </button>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold">
                  Save BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
