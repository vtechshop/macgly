import { useState } from 'react';
import {
  MessageSquare, AlertCircle, Search, Download, Send, X,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const SLA_HOURS = { urgent: 4, high: 24, medium: 48, low: 72 };

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', class: 'bg-red-100 text-red-700 border border-red-200' },
  high:   { label: 'High',   class: 'bg-orange-100 text-orange-700 border border-orange-200' },
  medium: { label: 'Medium', class: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  low:    { label: 'Low',    class: 'bg-green-100 text-green-700 border border-green-200' },
};

const STATUS_CONFIG = {
  open:          { label: 'Open',        class: 'bg-blue-100 text-blue-700' },
  'in-progress': { label: 'In Progress', class: 'bg-yellow-100 text-yellow-700' },
  resolved:      { label: 'Resolved',    class: 'bg-green-100 text-green-700' },
  closed:        { label: 'Closed',      class: 'bg-secondary-100 text-secondary-500' },
};

const CATEGORIES = [
  { value: 'payment', label: 'Payment' }, { value: 'commission', label: 'Commission' },
  { value: 'kyc', label: 'KYC' }, { value: 'technical', label: 'Technical' },
  { value: 'links', label: 'Links' }, { value: 'approval', label: 'Approval' },
  { value: 'products', label: 'Products' }, { value: 'orders', label: 'Orders' },
  { value: 'other', label: 'Other' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSLAStatus(createdAt, priority, status) {
  if (status === 'resolved' || status === 'closed') return { label: 'Completed', type: 'done' };
  const elapsed = (Date.now() - new Date(createdAt)) / 3600000;
  const limit = SLA_HOURS[priority] || 48;
  const remaining = limit - elapsed;
  if (remaining < 0) return { label: 'SLA Breached', type: 'breached' };
  if (remaining <= limit * 0.25) return { label: `${Math.ceil(remaining)}h left`, type: 'critical' };
  return { label: `${Math.ceil(remaining)}h left`, type: 'ok' };
}

function getAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 3600000);
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>;
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>;
}

function SLABadge({ sla }) {
  const cls = {
    done: 'bg-green-50 text-green-600', ok: 'bg-green-50 text-green-600',
    critical: 'bg-orange-50 text-orange-600', breached: 'bg-red-50 text-red-600',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls[sla.type] || cls.ok}`}>{sla.label}</span>;
}

// ─── Ticket Details Modal ─────────────────────────────────────────────────────
function TicketModal({ ticketId, onClose, onUpdate }) {
  const [rev, setRev] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [localStatus, setLocalStatus] = useState(null);
  const [localPriority, setLocalPriority] = useState(null);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const { data, isLoading } = useFetch(
    ['admin-ticket-detail', ticketId, rev],
    () => api.get(`/admin/tickets/${ticketId}`).then((r) => r.data.data)
  );
  const ticket = data;

  const effectiveStatus = localStatus ?? ticket?.status;
  const effectivePriority = localPriority ?? ticket?.priority;
  const statusChanged = localStatus && localStatus !== ticket?.status;
  const priorityChanged = localPriority && localPriority !== ticket?.priority;

  async function sendReply() {
    if (!replyText.trim()) return toast.error('Enter a reply message');
    setSending(true);
    try {
      await api.post(`/admin/tickets/${ticketId}/reply`, { message: replyText.trim() });
      setReplyText('');
      setRev((r) => r + 1);
      onUpdate();
      toast.success('Reply sent');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send reply');
    } finally { setSending(false); }
  }

  async function updateStatus() {
    setUpdating(true);
    try {
      await api.put(`/admin/tickets/${ticketId}/status`, { status: localStatus });
      setLocalStatus(null);
      setRev((r) => r + 1);
      onUpdate();
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  async function updatePriority() {
    setUpdating(true);
    try {
      await api.put(`/admin/tickets/${ticketId}/priority`, { priority: localPriority });
      setLocalPriority(null);
      setRev((r) => r + 1);
      onUpdate();
      toast.success('Priority updated');
    } catch { toast.error('Failed to update priority'); }
    finally { setUpdating(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !ticket ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-sm text-blue-200">{ticket.ticketNumber}</span>
                    <SLABadge sla={getSLAStatus(ticket.createdAt, ticket.priority, ticket.status)} />
                  </div>
                  <h2 className="text-lg font-bold">{ticket.subject}</h2>
                  <p className="text-blue-200 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{getAge(ticket.createdAt)}h old</span>
                    <span>·</span>
                    <span>{ticket.customerId?.name || 'Unknown'}</span>
                    <span>·</span>
                    <span className="capitalize">{ticket.category}</span>
                  </p>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg shrink-0 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body: 2-column */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Conversation */}
              <div className="flex-[3] flex flex-col border-r border-secondary-100 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {/* Original message */}
                  <div className="bg-secondary-50 rounded-xl p-4 border border-secondary-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                        {ticket.customerId?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-semibold">{ticket.customerId?.name || 'Customer'}</span>
                      <span className="text-xs text-secondary-400 ml-auto">{fmtTime(ticket.createdAt)}</span>
                    </div>
                    <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                  </div>

                  {/* Replies */}
                  {ticket.replies?.map((r, i) => (
                    <div key={i} className="bg-blue-50 rounded-xl p-4 border border-blue-100 ml-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          A
                        </div>
                        <span className="text-sm font-semibold text-blue-800">Support Team</span>
                        <span className="text-xs text-blue-400 ml-auto">{fmtTime(r.createdAt)}</span>
                      </div>
                      <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                    </div>
                  ))}

                  {!ticket.replies?.length && (
                    <p className="text-center text-xs text-secondary-400 py-4">No replies yet</p>
                  )}
                </div>

                {/* Reply box */}
                {ticket.status !== 'closed' && (
                  <div className="p-4 border-t border-secondary-100 shrink-0">
                    <textarea
                      className="input w-full resize-none text-sm"
                      rows={3}
                      placeholder="Type your reply…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <button
                        className="text-xs text-secondary-400 hover:text-secondary-600"
                        onClick={() => toast('File attachment coming soon')}
                      >
                        Attach File
                      </button>
                      <button
                        onClick={sendReply}
                        disabled={sending || !replyText.trim()}
                        className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                      >
                        {sending ? <Spinner size="sm" /> : <Send size={13} />}
                        {sending ? 'Sending…' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Sidebar */}
              <div className="flex-[2] overflow-y-auto p-4 space-y-4 bg-secondary-50/50">
                {/* Status */}
                <div className="bg-white rounded-xl border border-secondary-100 p-4">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-3">Status</p>
                  <select
                    className="input w-full text-sm mb-2"
                    value={effectiveStatus || ''}
                    onChange={(e) => setLocalStatus(e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  {statusChanged && (
                    <button onClick={updateStatus} disabled={updating} className="btn-primary w-full text-sm">
                      {updating ? 'Updating…' : 'Update Status'}
                    </button>
                  )}
                </div>

                {/* Priority */}
                <div className="bg-white rounded-xl border border-secondary-100 p-4">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-3">Priority</p>
                  <select
                    className="input w-full text-sm mb-2"
                    value={effectivePriority || ''}
                    onChange={(e) => setLocalPriority(e.target.value)}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {priorityChanged && (
                    <button onClick={updatePriority} disabled={updating} className="btn-primary w-full text-sm">
                      {updating ? 'Updating…' : 'Update Priority'}
                    </button>
                  )}
                </div>

                {/* SLA */}
                <div className="bg-white rounded-xl border border-secondary-100 p-4">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-3">SLA</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Status', value: <SLABadge sla={getSLAStatus(ticket.createdAt, ticket.priority, ticket.status)} /> },
                      { label: 'SLA Window', value: `${SLA_HOURS[ticket.priority] || 48}h` },
                      { label: 'Age', value: <span className={`font-medium ${getAge(ticket.createdAt) > 72 ? 'text-red-600' : getAge(ticket.createdAt) > 24 ? 'text-yellow-600' : ''}`}>{getAge(ticket.createdAt)}h</span> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-secondary-500">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer */}
                <div className="bg-white rounded-xl border border-secondary-100 p-4">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-3">Customer</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                      {ticket.customerId?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{ticket.customerId?.name || '—'}</p>
                      <p className="text-xs text-secondary-400 truncate">{ticket.customerId?.email || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-xl border border-secondary-100 p-4">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-3">Timeline</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-secondary-500 shrink-0">Created</span>
                      <span className="text-right">{fmtTime(ticket.createdAt)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-secondary-500 shrink-0">Updated</span>
                      <span className="text-right">{fmtTime(ticket.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminTickets() {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [listRev, setListRev] = useState(0);

  const { data: statsData } = useFetch(
    ['admin-ticket-stats', listRev],
    () => api.get('/admin/tickets/stats').then((r) => r.data)
  );

  const { data, isLoading } = useFetch(
    ['admin-tickets', statusFilter, priorityFilter, categoryFilter, searchTerm, page, listRev],
    () => api.get('/admin/tickets', {
      params: {
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        category: categoryFilter || undefined,
        search: searchTerm || undefined,
        page, limit: 20,
      },
    }).then((r) => r.data)
  );

  const tickets = data?.data || [];
  const meta = data?.meta || {};
  const stats = statsData || {};

  const urgentOpen = tickets.filter((t) => t.priority === 'urgent' && (t.status === 'open' || t.status === 'in-progress'));
  const breached = tickets.filter((t) => getSLAStatus(t.createdAt, t.priority, t.status).type === 'breached');

  function applyUrgentFilter() {
    setStatusFilter('open');
    setPriorityFilter('urgent');
    setPage(1);
  }

  function exportCSV() {
    const header = 'Ticket ID,Subject,Customer,Email,Priority,Status,Category,Age (hours),Created,Updated';
    const rows = tickets.map((t) => [
      t.ticketNumber, t.subject,
      t.customerId?.name || '', t.customerId?.email || '',
      t.priority, t.status, t.category,
      getAge(t.createdAt),
      new Date(t.createdAt).toLocaleDateString('en-IN'),
      new Date(t.updatedAt).toLocaleDateString('en-IN'),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'support-tickets.csv';
    a.click();
  }

  const STATUS_TABS = [
    { value: '',            label: 'All',         count: stats.total },
    { value: 'open',        label: 'Open',        count: stats.open },
    { value: 'in-progress', label: 'In Progress', count: stats.inProgress },
    { value: 'resolved',    label: 'Resolved',    count: stats.resolved },
    { value: 'closed',      label: 'Closed',      count: stats.closed },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Tickets from customers, vendors, and affiliates</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',       value: stats.total || 0,       colorVal: 'secondary', textColor: 'text-secondary-700' },
          { label: 'Open',        value: stats.open || 0,        colorVal: 'blue',      textColor: 'text-blue-600' },
          { label: 'In Progress', value: stats.inProgress || 0,  colorVal: 'yellow',    textColor: 'text-yellow-600' },
          { label: 'Resolved',    value: stats.resolved || 0,    colorVal: 'green',     textColor: 'text-green-600' },
          { label: 'Closed',      value: stats.closed || 0,      colorVal: 'secondary', textColor: 'text-secondary-500' },
        ].map(({ label, value, textColor }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-secondary-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${textColor}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {(breached.length > 0 || urgentOpen.length > 0) && (
        <div className="card p-4 flex items-center justify-between gap-4 border border-orange-200 bg-orange-50">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-orange-600 shrink-0" />
            <div className="flex gap-4 flex-wrap text-sm">
              {breached.length > 0 && <span className="font-semibold text-red-700">{breached.length} SLA Breached!</span>}
              {urgentOpen.length > 0 && <span className="font-semibold text-orange-700">{urgentOpen.length} Urgent Tickets</span>}
            </div>
          </div>
          <button onClick={applyUrgentFilter} className="btn text-xs shrink-0">View Urgent</button>
        </div>
      )}

      {/* Performance metrics */}
      {statsData && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Avg Response Time',   value: stats.avgResponseTime || 'N/A' },
            { label: 'Avg Resolution Time', value: stats.avgResolutionTime || 'N/A' },
            { label: 'SLA Compliance',      value: `${stats.slaCompliance ?? 0}%` },
            { label: 'CSAT Score',          value: `${stats.csat ?? 0}%` },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-xs text-secondary-500">{label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex border-b border-secondary-200">
        {STATUS_TABS.map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => { setStatusFilter(value); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              statusFilter === value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-800'
            }`}
          >
            {label}
            {count != null && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === value ? 'bg-blue-100 text-blue-700' : 'bg-secondary-100 text-secondary-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search by subject or ticket ID…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input text-sm" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="input text-sm" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={exportCSV} className="btn flex items-center gap-2 text-sm shrink-0">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No Tickets Found</p>
          <p className="text-sm mt-1">No support tickets match your filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
              <tr>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">SLA</th>
                <th className="px-4 py-3 text-left">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {tickets.map((t) => {
                const sla = getSLAStatus(t.createdAt, t.priority, t.status);
                const age = getAge(t.createdAt);
                const rowBg = sla.type === 'breached' ? 'bg-red-50/50' : t.priority === 'urgent' ? 'bg-orange-50/30' : '';
                return (
                  <tr
                    key={t._id}
                    onClick={() => setViewingTicket(t._id)}
                    className={`hover:bg-secondary-50 cursor-pointer transition-colors ${rowBg}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-secondary-400">{t.ticketNumber}</p>
                      <p className="text-xs text-secondary-400 mt-0.5">{fmtTime(t.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium line-clamp-1">{t.subject}</p>
                      {t.message && <p className="text-xs text-secondary-400 line-clamp-1 mt-0.5">{t.message}</p>}
                      {t.category && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs bg-secondary-100 text-secondary-500 capitalize">
                          {t.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.customerId?.name || '—'}</p>
                      <p className="text-xs text-secondary-400 truncate max-w-[140px]">{t.customerId?.email || ''}</p>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3"><SLABadge sla={sla} /></td>
                    <td className={`px-4 py-3 text-xs font-medium ${age > 72 ? 'text-red-600' : age > 24 ? 'text-yellow-600' : 'text-secondary-500'}`}>
                      {age}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {meta.page} of {meta.totalPages} · {meta.total} tickets</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewingTicket && (
        <TicketModal
          ticketId={viewingTicket}
          onClose={() => setViewingTicket(null)}
          onUpdate={() => setListRev((r) => r + 1)}
        />
      )}
    </div>
  );
}
