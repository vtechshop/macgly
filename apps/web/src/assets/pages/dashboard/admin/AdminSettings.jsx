import { useState, useCallback } from 'react';
import {
  Settings, Globe, Layers, Megaphone, Mail, CreditCard, Truck,
  Shield, Bell, Zap, Code, Wrench, RefreshCw, Upload, Download,
  Copy, Check, X, Eye, EyeOff, ChevronDown, ChevronRight, Volume2,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Sound preference (localStorage only) ─────────────────────────────────────

const SOUND_KEY = 'sound_notifications_enabled';
function getSoundEnabled() { return localStorage.getItem(SOUND_KEY) !== 'false'; }
function setSoundEnabled(val) { localStorage.setItem(SOUND_KEY, val ? 'true' : 'false'); }

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',       label: 'General',       icon: Globe       },
  { id: 'website',       label: 'Website',        icon: Layers      },
  { id: 'ads',           label: 'Ads',            icon: Megaphone   },
  { id: 'email',         label: 'Email',          icon: Mail        },
  { id: 'payment',       label: 'Payment',        icon: CreditCard  },
  { id: 'shipping',      label: 'Shipping',       icon: Truck       },
  { id: 'security',      label: 'Security',       icon: Shield      },
  { id: 'notifications', label: 'Notifications',  icon: Bell        },
  { id: 'features',      label: 'Features',       icon: Zap         },
  { id: 'integrations',  label: 'Integrations',   icon: Code        },
  { id: 'maintenance',   label: 'Maintenance',    icon: Wrench      },
];

const LANG_LABELS = { en: 'English', ta: 'Tamil', hi: 'Hindi' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBooleanSetting(s) {
  return s.type === 'boolean' || /enabled$/i.test(s.key);
}

function isSecret(key) {
  return /secret|password|api_key/i.test(key);
}

function getBoolValue(raw) {
  return raw === true || raw === 'true';
}

function getInputKind(s) {
  if (isBooleanSetting(s)) return 'boolean';
  if (s.key === 'site.language') return 'language';
  if (/priority/i.test(s.key)) return 'priority';
  if (s.type === 'number') return 'number';
  if (s.type === 'json' || /config|fallback/i.test(s.key)) return 'json';
  if (isSecret(s.key)) return 'password';
  if (s.type === 'url' || /url/i.test(s.key)) return 'url';
  if (/email/i.test(s.key) && s.key !== 'features.newsletter_enabled') return 'email';
  return 'text';
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={copy} className="ml-2 p-1 rounded hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors" title="Copy">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  );
}

// ─── Display value ────────────────────────────────────────────────────────────

function DisplayValue({ setting }) {
  const [revealed, setRevealed] = useState(false);
  const { key, value, type } = setting;
  const raw = value ?? '';

  if (isBooleanSetting(setting)) {
    const on = getBoolValue(raw);
    return on
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">✓ Enabled</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-500 text-xs font-semibold">✗ Disabled</span>;
  }

  if (key === 'site.language') {
    return <span className="text-sm">{LANG_LABELS[raw] || raw || '—'}</span>;
  }

  if (/priority/i.test(key)) {
    const colors = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${colors[String(raw).toLowerCase()] || 'bg-secondary-100 text-secondary-600'}`}>{raw}</span>;
  }

  if (isSecret(key)) {
    return (
      <span className="flex items-center gap-1 text-sm font-mono">
        {revealed ? String(raw || '') : '••••••••••••'}
        <button onClick={() => setRevealed((r) => !r)} className="ml-1 text-secondary-400 hover:text-secondary-600">
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        {revealed && raw && <CopyBtn text={raw} />}
      </span>
    );
  }

  if (type === 'json') {
    let parsed = raw;
    try { parsed = JSON.stringify(JSON.parse(String(raw)), null, 2); } catch (_) { parsed = String(raw); }
    return <pre className="text-xs font-mono bg-secondary-50 rounded p-2 max-h-24 overflow-auto">{parsed}</pre>;
  }

  if (!raw && raw !== 0) return <span className="text-secondary-300 text-sm italic">—</span>;

  return (
    <span className="flex items-center text-sm group">
      <span className="text-secondary-700">{String(raw)}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={raw} /></span>
    </span>
  );
}

// ─── Edit Input ───────────────────────────────────────────────────────────────

function EditInput({ setting, editValue, onChange }) {
  const kind = getInputKind(setting);

  if (kind === 'boolean') {
    const on = getBoolValue(editValue);
    return (
      <div className="flex gap-2">
        <button onClick={() => onChange('true')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${on ? 'bg-green-500 text-white border-green-500' : 'border-secondary-200 hover:bg-green-50'}`}>
          Enabled
        </button>
        <button onClick={() => onChange('false')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${!on ? 'bg-red-500 text-white border-red-500' : 'border-secondary-200 hover:bg-red-50'}`}>
          Disabled
        </button>
      </div>
    );
  }

  if (kind === 'language') {
    return (
      <select className="input w-48 text-sm" value={editValue} onChange={(e) => onChange(e.target.value)}>
        <option value="en">English</option>
        <option value="ta">Tamil</option>
        <option value="hi">Hindi</option>
      </select>
    );
  }

  if (kind === 'priority') {
    return (
      <select className="input w-36 text-sm" value={editValue} onChange={(e) => onChange(e.target.value)}>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    );
  }

  if (kind === 'json') {
    return (
      <textarea
        className="input w-full h-28 resize-y text-xs font-mono"
        value={editValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder='{"key": "value"}'
      />
    );
  }

  const inputProps = {
    className: 'input w-full text-sm',
    value: editValue,
    onChange: (e) => onChange(e.target.value),
  };

  if (kind === 'password') return <input {...inputProps} type="password" autoComplete="new-password" />;
  if (kind === 'number')   return <input {...inputProps} type="number" />;
  if (kind === 'url')      return <input {...inputProps} type="url" placeholder="https://" />;
  if (kind === 'email')    return <input {...inputProps} type="email" />;
  return <input {...inputProps} type="text" />;
}

// ─── Setting Row ──────────────────────────────────────────────────────────────

function SettingRow({ setting, editing, onEdit, onCancel, onSave, saving }) {
  const isEditing = !!editing;
  const editValue = editing?.value ?? String(setting.value ?? '');

  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-secondary-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0 mt-0.5">
        <Settings size={14} className="text-secondary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono text-sm font-semibold text-secondary-800">{setting.key}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary-100 text-secondary-500">{setting.type}</span>
          {setting.isPublic && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-600">Public</span>
          )}
        </div>
        {setting.description && (
          <p className="text-xs text-secondary-400 mb-2">{setting.description}</p>
        )}
        {isEditing ? (
          <EditInput
            setting={setting}
            editValue={editValue}
            onChange={(v) => onEdit({ ...editing, value: v })}
          />
        ) : (
          <DisplayValue setting={setting} />
        )}
        {setting.updatedAt && (
          <p className="text-[10px] text-secondary-300 mt-1.5">
            Updated {new Date(setting.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {isEditing ? (
          <>
            <button
              onClick={() => onSave(setting.key, editValue)}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold border border-secondary-200 rounded-lg hover:bg-secondary-50">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => onEdit({ value: String(setting.value ?? '') })}
            className="px-3 py-1.5 text-xs font-semibold border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Group Block ──────────────────────────────────────────────────────────────

function GroupBlock({ name, settings, editingSettings, onEdit, onCancel, onSave, savingKeys }) {
  const [collapsed, setCollapsed] = useState(false);
  const label = name === 'other' ? 'Other' : name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div className="card overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-secondary-900 text-white hover:bg-secondary-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-secondary-400" />
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-xs text-secondary-400">({settings.length})</span>
        </div>
        {collapsed ? <ChevronRight size={15} className="text-secondary-400" /> : <ChevronDown size={15} className="text-secondary-400" />}
      </button>
      {!collapsed && (
        <div className="divide-y divide-secondary-50">
          {settings.map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              editing={editingSettings[s.key]}
              onEdit={(val) => onEdit(s.key, val)}
              onCancel={() => onCancel(s.key)}
              onSave={onSave}
              saving={!!savingKeys[s.key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onSuccess }) {
  const [importData, setImportData] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    let parsed;
    try {
      parsed = JSON.parse(importData);
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
    } catch (e) {
      toast.error(`Invalid JSON: ${e.message}`);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/settings/bulk-update', { settings: parsed });
      toast.success(`Imported ${data.updatedCount} settings${data.errorsCount ? ` (${data.errorsCount} errors)` : ''}`);
      onSuccess();
      onClose();
    } catch {
      toast.error('Import failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h3 className="font-bold text-secondary-900">Import Settings</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            Importing will overwrite existing values for matching keys. Unknown keys will be created.
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">Paste JSON array</label>
            <textarea
              className="input w-full h-48 resize-none text-xs font-mono"
              placeholder='[{"key":"site.name","value":"My Store","type":"string","category":"general"}]'
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50">
              Cancel
            </button>
            <button onClick={submit} disabled={saving || !importData.trim()}
              className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [editingSettings, setEditingSettings] = useState({});
  const [savingKeys, setSavingKeys] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled);
  const [rev, setRev] = useState(0);

  const { data: stats } = useFetch(
    ['settings-stats', rev],
    () => api.get('/admin/settings/stats').then((r) => r.data),
  );

  const { data: rawSettings, isLoading } = useFetch(
    ['admin-settings', activeTab, rev],
    () => api.get('/admin/settings', { params: { category: activeTab } }).then((r) => r.data),
  );

  function refresh() {
    setRev((r) => r + 1);
    setEditingSettings({});
  }

  function handleEdit(key, val) {
    setEditingSettings((e) => ({ ...e, [key]: val }));
  }

  function handleCancel(key) {
    setEditingSettings((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  async function handleSave(key, value) {
    setSavingKeys((s) => ({ ...s, [key]: true }));
    try {
      await api.put(`/admin/settings/${encodeURIComponent(key)}`, { value });
      toast.success(`Saved ${key}`);
      setEditingSettings((e) => { const n = { ...e }; delete n[key]; return n; });
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSavingKeys((s) => { const n = { ...s }; delete n[key]; return n; });
    }
  }

  async function handleExport() {
    try {
      const { data } = await api.get('/admin/settings/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch {
      toast.error('Export failed');
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEnabled(next);
    toast.success(`Sound notifications ${next ? 'enabled' : 'disabled'}`);
  }

  const settings = Array.isArray(rawSettings) ? rawSettings : [];

  // Client-side search filter
  const filtered = searchTerm
    ? settings.filter((s) => {
        const q = searchTerm.toLowerCase();
        return s.key.toLowerCase().includes(q)
          || (s.description || '').toLowerCase().includes(q)
          || String(s.value || '').toLowerCase().includes(q);
      })
    : settings;

  // Group by key prefix
  const groups = {};
  filtered.forEach((s) => {
    const parts = s.key.split('.');
    const groupName = parts.length > 1 ? parts[0] : 'other';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(s);
  });

  const groupEntries = Object.entries(groups).sort(([a], [b]) => {
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return a.localeCompare(b);
  });

  const statCards = [
    { label: 'Total Settings', value: stats?.total ?? '—' },
    { label: 'Categories',     value: stats?.categories ?? '—' },
    { label: 'Public',         value: stats?.public ?? '—' },
    { label: 'Private',        value: stats?.private ?? '—' },
    { label: 'Updated Today',  value: stats?.recentlyUpdated ?? '—' },
    { label: 'Features On',    value: stats?.featuresEnabled ?? '—' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">System Settings</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Configure your platform settings and preferences</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <Upload size={14} /> Import
          </button>
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-blue-700 text-white rounded-lg">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Settings Overview dark card */}
      <div className="rounded-2xl bg-[#1a1f2e] text-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <Settings size={20} className="text-blue-400" />
          <div>
            <h2 className="font-bold">Settings Overview</h2>
            <p className="text-xs text-gray-400">Platform configuration at a glance</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sound Notifications toggle */}
      <div className="card px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Volume2 size={17} className="text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-secondary-800">Sound Notifications</p>
            <p className="text-xs text-secondary-400">Play sounds for new orders and other actions</p>
          </div>
        </div>
        <button
          onClick={toggleSound}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-blue-500' : 'bg-secondary-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = stats?.byCategory?.[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setEditingSettings({}); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-secondary-900 text-white'
                  : 'border border-secondary-200 text-secondary-600 hover:bg-secondary-50'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {count != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-secondary-100'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Settings size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input pl-8 text-sm w-full"
          placeholder="Search settings by key, value, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Search hint */}
      {!searchTerm && filtered.length > 0 && (
        <p className="text-xs text-secondary-400 flex items-center gap-1.5">
          <Settings size={11} />
          {TABS.find((t) => t.id === activeTab)?.label} settings ({filtered.length})
        </p>
      )}

      {/* Settings list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Settings size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{searchTerm ? 'No settings match your search' : 'No settings in this category'}</p>
        </div>
      ) : (
        <div>
          {groupEntries.map(([groupName, groupSettings]) => (
            <GroupBlock
              key={groupName}
              name={groupName}
              settings={groupSettings}
              editingSettings={editingSettings}
              onEdit={handleEdit}
              onCancel={handleCancel}
              onSave={handleSave}
              savingKeys={savingKeys}
            />
          ))}
        </div>
      )}

      {/* Import modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
