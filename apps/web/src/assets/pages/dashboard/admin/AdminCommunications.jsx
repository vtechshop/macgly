import { useState } from 'react';
import {
  Mail, MessageCircle, Phone, Bell, Megaphone, Headphones,
  Search, Download, RefreshCw, Eye, Trash2, X,
  Send, Clock, CheckCircle, AlertCircle,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const CHANNELS = [
  { key: 'email',        label: 'Email',     icon: Mail,          color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  { key: 'whatsapp',     label: 'WhatsApp',  icon: MessageCircle, color: 'text-green-400',  bg: 'bg-green-500/10' },
  { key: 'sms',          label: 'SMS',       icon: Phone,         color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'notification', label: 'Push',      icon: Bell,          color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'marketing',    label: 'Marketing', icon: Megaphone,     color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { key: 'support',      label: 'Support',   icon: Headphones,    color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
];

const STATUS_CFG = {
  pending:   { label: 'Pending',   class: 'bg-yellow-100 text-yellow-700', icon: Clock },
  sent:      { label: 'Sent',      class: 'bg-blue-100 text-blue-700',     icon: Send },
  delivered: { label: 'Delivered', class: 'bg-green-100 text-green-700',   icon: CheckCircle },
  failed:    { label: 'Failed',    class: 'bg-red-100 text-red-600',       icon: AlertCircle },
  read:      { label: 'Read',      class: 'bg-purple-100 text-purple-700', icon: Eye },
};

const CHANNEL_ICON = Object.fromEntries(CHANNELS.map((c) => [c.key, c.icon]));

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Message Details Modal ────────────────────────────────────────────────────
function MessageModal({ message: msg, onClose }) {
  const status = STATUS_CFG[msg.status] || STATUS_CFG.sent;
  const StatusIcon = status.icon;
  const ChanIcon = CHANNEL_ICON[msg.type] || Mail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <ChanIcon size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold capitalize">{msg.type} Message</p>
              <p className="text-xs text-secondary-400 font-mono">…{String(msg._id).slice(-8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary-100 rounded-lg"><X size={18} className="text-secondary-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* Status + Direction */}
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.class}`}>
              <StatusIcon size={11} /> {status.label}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${msg.direction === 'outgoing' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {msg.direction === 'outgoing' ? '↗ Outgoing' : '↙ Incoming'}
            </span>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 gap-4">
            {[['From', msg.fromName, msg.from], ['To', msg.toName, msg.to]].map(([label, name, addr]) => (
              <div key={label} className="bg-secondary-50 rounded-xl p-3">
                <p className="text-xs text-secondary-400 mb-1">{label}</p>
                {name && <p className="font-semibold">{name}</p>}
                <p className="text-secondary-500 text-xs truncate">{addr || '—'}</p>
              </div>
            ))}
          </div>

          {/* Subject */}
          {msg.subject && (
            <div>
              <p className="text-xs text-secondary-400 mb-1">Subject</p>
              <p className="font-medium">{msg.subject}</p>
            </div>
          )}

          {/* Body */}
          {msg.message && (
            <div>
              <p className="text-xs text-secondary-400 mb-1">Message</p>
              <div className="bg-blue-50 rounded-xl p-4 text-secondary-700 whitespace-pre-wrap leading-relaxed text-sm">
                {msg.message}
              </div>
            </div>
          )}

          {/* HTML preview */}
          {msg.htmlContent && (
            <div>
              <p className="text-xs text-secondary-400 mb-1">HTML Preview</p>
              <div className="border border-secondary-200 rounded-xl p-4 max-h-48 overflow-y-auto text-sm"
                dangerouslySetInnerHTML={{ __html: msg.htmlContent }} />
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs text-secondary-400 mb-2">Timeline</p>
            <div className="space-y-1.5">
              {[
                { label: 'Created',   time: msg.createdAt,   color: 'text-secondary-500' },
                { label: 'Sent',      time: msg.sentAt,      color: 'text-blue-600' },
                { label: 'Delivered', time: msg.deliveredAt, color: 'text-green-600' },
                { label: 'Read',      time: msg.readAt,      color: 'text-purple-600' },
              ].filter((t) => t.time).map(({ label, time, color }) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="text-secondary-400 w-16">{label}</span>
                  <span className={`font-medium ${color}`}>{fmtDate(time)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {msg.status === 'failed' && msg.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-xs">
              <p className="font-semibold mb-1">Error</p>
              <p>{msg.errorMessage}</p>
            </div>
          )}

          {/* Metadata */}
          {msg.metadata && Object.keys(msg.metadata).length > 0 && (
            <div>
              <p className="text-xs text-secondary-400 mb-1">Metadata</p>
              <pre className="bg-secondary-50 rounded-xl p-3 text-xs overflow-x-auto">{JSON.stringify(msg.metadata, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminCommunications() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: '', status: '', direction: '', search: '' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewingMessage, setViewingMessage] = useState(null);
  const [statsRev, setStatsRev] = useState(0);
  const [listRev, setListRev] = useState(0);

  const { data: statsData } = useFetch(
    ['comm-stats', statsRev],
    () => api.get('/admin/communications/stats').then((r) => r.data)
  );

  const { data, isLoading } = useFetch(
    ['comm-list', filters, page, listRev],
    () => api.get('/admin/communications', {
      params: { page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) },
    }).then((r) => r.data)
  );

  const stats = statsData?.data || {};
  const messages = data?.data || [];
  const meta = data?.meta || {};

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); setSelectedItems([]); };
  const toggleChannel = (key) => setFilter('type', filters.type === key ? '' : key);
  const refresh = () => { setStatsRev((r) => r + 1); setListRev((r) => r + 1); };

  const deliveryRate = stats.total > 0 ? Math.round(((stats.delivered || 0) / stats.total) * 100) : 0;

  const allSelected = messages.length > 0 && messages.every((m) => selectedItems.includes(m._id));
  function toggleAll(checked) { setSelectedItems(checked ? messages.map((m) => m._id) : []); }
  function toggleOne(id) { setSelectedItems((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }

  async function bulkAction(action) {
    if (!selectedItems.length) return;
    try {
      await api.post('/admin/communications/bulk-update', { ids: selectedItems, action });
      toast.success(`${selectedItems.length} message(s) ${action === 'delete' ? 'deleted' : action === 'read' ? 'marked as read' : 'archived'}`);
      setSelectedItems([]);
      setListRev((r) => r + 1);
      setStatsRev((r) => r + 1);
    } catch { toast.error('Bulk action failed'); }
  }

  async function deleteOne(id) {
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/admin/communications/${id}`);
      toast.success('Deleted');
      setListRev((r) => r + 1);
      setStatsRev((r) => r + 1);
    } catch { toast.error('Delete failed'); }
  }

  function exportCSV() {
    const header = 'Date,Type,Direction,From,To,Subject,Status';
    const rows = messages.map((m) => [
      fmtDate(m.createdAt), m.type, m.direction,
      m.fromName || m.from || '', m.toName || m.to || '',
      m.subject || (m.message || '').slice(0, 50), m.status,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'communications.csv'; a.click();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Communication Hub</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage all customer communications in one place</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn flex items-center gap-1.5 text-sm"><RefreshCw size={13} /> Refresh</button>
          <button onClick={exportCSV} className="btn-primary flex items-center gap-1.5 text-sm"><Download size={13} /> Export CSV</button>
        </div>
      </div>

      {/* Dark overview panel */}
      <div className="rounded-2xl bg-gradient-to-br from-secondary-900 to-secondary-800 text-white p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="font-semibold">Communication Overview</p>
          <span className="flex items-center gap-1.5 text-xs bg-white/10 px-2.5 py-1 rounded-full text-secondary-300">
            <BarChart size={11} /> Last 30 days
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total Messages', value: stats.total || 0 },
            { label: 'Last 24h',       value: stats.recent24h || 0 },
            { label: 'Delivered',      value: stats.delivered || 0 },
            { label: 'Pending',        value: stats.pending || 0 },
            { label: 'Failed',         value: stats.failed || 0 },
            { label: 'Delivery Rate',  value: `${deliveryRate}%`, colored: true },
          ].map(({ label, value, colored }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-secondary-400">{label}</p>
              <p className={`text-xl font-bold mt-1 ${colored ? 'text-green-400' : 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {CHANNELS.map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => toggleChannel(key)}
            className={`card p-4 flex items-start justify-between transition-all hover:shadow-md ${filters.type === key ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
          >
            <div className="flex flex-col items-start gap-1">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-xs text-secondary-500 mt-1">{label}</p>
            </div>
            <p className="text-2xl font-bold">{stats.byType?.[key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input className="input pl-8 text-sm w-full" placeholder="Search messages…" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        </div>
        <select className="input text-sm w-44 shrink-0" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">All Channels</option>
          {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="input text-sm w-36 shrink-0" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All Status</option>
          {Object.entries(STATUS_CFG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select className="input text-sm w-40 shrink-0" value={filters.direction} onChange={(e) => setFilter('direction', e.target.value)}>
          <option value="">All Directions</option>
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
        </select>
      </div>

      {/* Bulk actions */}
      {selectedItems.length > 0 && (
        <div className="card p-3 flex items-center gap-4 bg-blue-50 border border-blue-200">
          <span className="text-sm font-semibold text-blue-700">{selectedItems.length} selected</span>
          <button onClick={() => bulkAction('read')} className="text-sm btn py-1">Mark as Read</button>
          <button onClick={() => bulkAction('archive')} className="text-sm btn py-1">Archive</button>
          <button onClick={() => bulkAction('delete')} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          <button onClick={() => setSelectedItems([])} className="ml-auto text-xs text-secondary-400 hover:text-secondary-600">Clear</button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : messages.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Mail size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No messages found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-900 text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" className="rounded" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
                </th>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Direction</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Subject/Message</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {messages.map((m) => {
                const sc = STATUS_CFG[m.status] || STATUS_CFG.sent;
                const StatusIcon = sc.icon;
                const ChanIcon = CHANNEL_ICON[m.type] || Mail;
                const chan = CHANNELS.find((c) => c.key === m.type);
                return (
                  <tr key={m._id} onClick={() => setViewingMessage(m)} className="hover:bg-secondary-50 cursor-pointer transition-colors">
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded" checked={selectedItems.includes(m._id)} onChange={() => toggleOne(m._id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ChanIcon size={14} className={chan?.color || 'text-secondary-400'} />
                        <span className="capitalize text-xs font-medium">{m.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${m.direction === 'outgoing' ? 'text-green-600' : 'text-blue-600'}`}>
                        {m.direction === 'outgoing' ? '↗ OUT' : '↙ IN'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium line-clamp-1">{m.fromName || m.from || '—'}</p>
                      {m.fromName && <p className="text-xs text-secondary-400 truncate max-w-[120px]">{m.from}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium line-clamp-1">{m.toName || m.to || '—'}</p>
                      {m.toName && <p className="text-xs text-secondary-400 truncate max-w-[120px]">{m.to}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {m.subject && <p className="text-xs font-medium line-clamp-1">{m.subject}</p>}
                      <p className="text-xs text-secondary-400 line-clamp-1">{m.message || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${sc.class}`}>
                        <StatusIcon size={10} /> {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-500 whitespace-nowrap">
                      <p>{new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                      <p className="text-secondary-400">{new Date(m.createdAt).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewingMessage(m)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><Eye size={13} className="text-blue-500" /></button>
                        <button onClick={() => deleteOne(m._id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={13} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {meta.page} of {meta.totalPages} · {meta.total} messages</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewingMessage && <MessageModal message={viewingMessage} onClose={() => setViewingMessage(null)} />}
    </div>
  );
}

// ─── Missing import ───────────────────────────────────────────────────────────
function BarChart({ size, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
