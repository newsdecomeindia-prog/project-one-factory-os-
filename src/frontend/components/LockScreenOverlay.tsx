import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ShieldAlert, KeyRound } from 'lucide-react';

interface LockScreenProps {
  onUnlockSuccess: () => void;
}

export const LockScreenOverlay: React.FC<LockScreenProps> = ({ onUnlockSuccess }) => {
  const { user, token } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Incorrect password');
      }

      onUnlockSuccess();
    } catch (err: any) {
      setError(err.message || 'Unlock failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 text-center text-white shadow-2xl">
        <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
          <Lock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-bold">Session Auto-Locked</h2>
          <p className="text-xs text-slate-400 mt-1">Locked due to 5 minutes of inactivity.</p>
          <div className="mt-3 inline-block px-3 py-1 bg-slate-800 rounded-full text-xs font-mono text-slate-300">
            {user?.email}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center space-x-2 text-red-300 text-xs text-left">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to unlock"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2"
          >
            {loading ? <span>Unlocking...</span> : <span>Unlock Workplace</span>}
          </button>
        </form>
      </div>
    </div>
  );
};
