import { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [saving, setSaving] = useState({});
  const [edits, setEdits] = useState({});
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-settings', rev],
    () => api.get('/admin/settings').then((r) => r.data)
  );

  const configs = data?.configs || [];

  async function saveKey(key, value) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await api.put(`/admin/settings/${key}`, { value });
      toast.success(`Saved ${key}`);
      setEdits((e) => { const n = { ...e }; delete n[key]; return n; });
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[key]; return n; });
    }
  }

  function getDisplay(cfg) {
    const val = edits[cfg.key] !== undefined ? edits[cfg.key] : (typeof cfg.value === 'object' ? JSON.stringify(cfg.value, null, 2) : String(cfg.value ?? ''));
    return val;
  }

  function isChanged(cfg) {
    return edits[cfg.key] !== undefined;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">App Settings</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Configure platform-wide settings</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : configs.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Settings size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No settings found</p>
        </div>
      ) : (
        <div className="card divide-y divide-secondary-100">
          {configs.map((cfg) => {
            const display = getDisplay(cfg);
            const changed = isChanged(cfg);
            const isMultiline = display.length > 60 || display.includes('\n');
            return (
              <div key={cfg.key} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-secondary-800">{cfg.key}</p>
                  {cfg.description && <p className="text-xs text-secondary-400 mt-0.5">{cfg.description}</p>}
                  <div className="mt-2">
                    {isMultiline ? (
                      <textarea
                        className="input w-full resize-y text-sm font-mono"
                        rows={Math.min(8, display.split('\n').length + 1)}
                        value={display}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className="input w-full text-sm"
                        value={display}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
                <button
                  disabled={!changed || saving[cfg.key]}
                  onClick={() => saveKey(cfg.key, edits[cfg.key])}
                  className="btn-primary flex items-center gap-1.5 py-1.5 px-3 text-xs mt-7 shrink-0 disabled:opacity-40"
                >
                  {saving[cfg.key] ? <Spinner size="xs" /> : <Save size={13} />}
                  Save
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
