import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileSearch, Filter, AlertCircle } from 'lucide-react';

export const AuditTrailViewer: React.FC = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (entityFilter) queryParams.append('entity', entityFilter);
      if (actionFilter) queryParams.append('action', actionFilter);

      const res = await fetch(`/api/v1/audit-logs?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setLogs(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token, entityFilter, actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-blue-600" />
            Centralized Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Immutable event record tracking all mutations, logins, and authorization state changes.</p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="">All Entities</option>
            <option value="Company">Company</option>
            <option value="Plant">Plant</option>
            <option value="Department">Department</option>
            <option value="User">User</option>
            <option value="Role">Role</option>
            <option value="RolePermission">RolePermission</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DEACTIVATE">DEACTIVATE</option>
            <option value="REVERSE">REVERSE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="PERMISSION_CHANGE">PERMISSION_CHANGE</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading audit trail logs...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Entity</th>
                  <th className="p-3.5">Record ID</th>
                  <th className="p-3.5">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-sans font-medium text-slate-800">
                      {log.userEmail || log.userId || 'System'}
                    </td>
                    <td className="p-3.5 font-sans">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'DEACTIVATE' || log.action === 'REVERSE'
                            ? 'bg-amber-100 text-amber-800'
                            : log.action === 'LOGIN' || log.action === 'LOGOUT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-sans font-semibold text-slate-700">{log.entity}</td>
                    <td className="p-3.5 text-slate-500 text-[11px] truncate max-w-[120px]">{log.recordId}</td>
                    <td className="p-3.5 font-sans text-slate-600">
                      {log.reason ? (
                        <span className="font-medium text-amber-900 bg-amber-50 px-2 py-1 rounded border border-amber-200/60 block">
                          Reason: {log.reason}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">No reason logged</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
