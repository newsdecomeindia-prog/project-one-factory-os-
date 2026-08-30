import React, { useState, useEffect } from 'react';

export const GeneralLedgerViewer: React.FC = () => {
  const [journals, setJournals] = useState<any[]>([]);

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/finance/journals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setJournals(data.data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">General Ledger & Double-Entry Journal Audit</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 p-4 border-b">Posted GL Journals</h3>
        <div className="divide-y divide-gray-200">
          {journals.map((j) => (
            <div key={j.id} className="p-4 space-y-2">
              <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <div>
                  <span className="font-bold text-purple-700 mr-2">{j.journalNumber}</span>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded mr-2">{j.sourceDocumentType}</span>
                  {j.isReversal && <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-1 rounded">REVERSAL ENTRY</span>}
                </div>
                <div className="text-xs text-gray-500">
                  Posted on {new Date(j.createdAt).toLocaleString()} by {j.postedUser?.firstName || 'System'}
                </div>
              </div>

              <table className="min-w-full divide-y divide-gray-100 text-xs">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="py-1">Account Code</th>
                    <th className="py-1">Account Name</th>
                    <th className="py-1">Description</th>
                    <th className="py-1 text-right">Debit (₹)</th>
                    <th className="py-1 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {j.lines?.map((line: any) => (
                    <tr key={line.id}>
                      <td className="py-1 font-mono">{line.accountCode}</td>
                      <td className="py-1 font-medium">{line.accountName}</td>
                      <td className="py-1 text-gray-600">{line.lineDescription}</td>
                      <td className="py-1 text-right font-mono text-green-700">{line.debitAmount > 0 ? `₹${line.debitAmount}` : '-'}</td>
                      <td className="py-1 text-right font-mono text-blue-700">{line.creditAmount > 0 ? `₹${line.creditAmount}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
