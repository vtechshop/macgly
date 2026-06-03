import { useState, useRef } from 'react';
import {
  Plus, RefreshCw, Search, Filter, X, Send,
  CircleDot, Clock, CheckCircle2, XCircle,
  HelpCircle, Paperclip, Bell, Mail, Phone,
  ChevronRight, Loader2,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatDate } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import toast from 'react-hot-toast';

// ─── Static config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  open:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700',        icon: CircleDot },
  in_progress: { label: 'In Progress', cls: 'bg-yellow-100 text-yellow-700',    icon: Clock },
  resolved:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700',      icon: CheckCircle2 },
  closed:      { label: 'Closed',      cls: 'bg-secondary-100 text-secondary-500', icon: XCircle },
};

const PRIORITY_CFG = {
  urgent: { label: 'Urgent', cls: 'text-red-600',    dot: 'bg-red-500' },
  high:   { label: 'High',   cls: 'text-orange-500', dot: 'bg-orange-400' },
  medium: { label: 'Medium', cls: 'text-blue-600',   dot: 'bg-blue-400' },
  low:    { label: 'Low',    cls: 'text-secondary-500', dot: 'bg-secondary-300' },
};

const CATEGORIES = [
  { value: 'approval',  label: 'Account Approval' },
  { value: 'payment',   label: 'Payment / Settlement' },
  { value: 'kyc',       label: 'KYC Verification' },
  { value: 'products',  label: 'Product Listing' },
  { value: 'orders',    label: 'Orders & Returns' },
  { value: 'shipping',  label: 'Shipping' },
  { value: 'technical', label: 'Technical Problem' },
  { value: 'other',     label: 'Other' },
];

const STATUS_FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'closed',      label: 'Closed' },
];

const EMPTY_FORM = { subject: '', description: '', category: 'other', priority: 'medium' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, role }) {
  const bg = role === 'support' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-600';
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${bg}`}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function StatsCard({ label, value, color, active, onClick, badge }) {
  const colors = {
    blue:   { card: active ? 'border-blue-500 bg-blue-50'   : 'border-secondary-200 hover:border-blue-300',   val: 'text-blue-600' },
    yellow: { card: active ? 'border-yellow-400 bg-yellow-50': 'border-secondary-200 hover:border-yellow-300', val: 'text-yellow-600' },
    green:  { card: active ? 'border-green-500 bg-green-50'  : 'border-secondary-200 hover:border-green-300',  val: 'text-green-600' },
  };
  const c = colors[color] || colors.blue;
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-all w-full ${c.card}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary-500">{label}</span>
        {badge > 0 && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 animate-pulse">
            {badge} new
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold mt-1 ${c.val}`}>{value}</p>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VendorSupport() {
  const [rev, setRev] = useState(0);

  // List state
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showFilters,    setShowFilters]    = useState(false);

  // Create modal
  const [showCreate,   setShowCreate]   = useState(false);
  const [formData,     setFormData]     = useState({ ...EMPTY_FORM });
  const [attachments,  setAttachments]  = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [creating,     setCreating]     = useState(false);
  const fileInputRef = useRef(null);

  // View modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newMessage,     setNewMessage]     = useState('');
  const [sending,        setSending]        = useState(false);
  const [ticketRev,      setTicketRev]      = useState(0);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: listData, isLoading: listLoading } = useFetch(
    ['vendor-tickets', rev],
    () => api.get('/tickets').then((r) => r.data)
  );

  const { data: statsData } = useFetch(
    ['vendor-ticket-stats', rev],
    () => api.get('/tickets/my-stats').then((r) => r.data)
  );

  const { data: detailData, isLoading: detailLoading } = useFetch(
    ['ticket', selectedTicket, ticketRev],
    () => api.get(`/tickets/${selectedTicket}`).then((r) => r.data),
    { enabled: !!selectedTicket }
  );

  const allTickets = listData?.tickets || [];
  const stats      = statsData || { total: 0, open: 0, inProgress: 0, resolved: 0, unread: 0 };
  const ticket     = detailData?.ticket || null;

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredTickets = allTickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.subject?.toLowerCase().includes(q) && !t.ticketId?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function refresh() {
    invalidateCache('vendor-tickets');
    invalidateCache('vendor-ticket-stats');
    setRev((r) => r + 1);
  }

  function openTicket(id) {
    setSelectedTicket(id);
    setTicketRev(0);
    setNewMessage('');
  }

  function closeTicket() {
    setSelectedTicket(null);
    refresh();
  }

  async function handleFileAttach(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('folder', 'ticket-attachments');
      const { data } = await api.post('/upload/multiple', fd);
      const urls = (data.urls || []).map((u) => u.url || u);
      setAttachments((a) => [...a, ...urls]);
      toast.success(`${urls.length} file(s) attached`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCreateTicket(e) {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      return toast.error('Subject and description are required');
    }
    setCreating(true);
    try {
      const { data } = await api.post('/tickets', { ...formData, attachments });
      toast.success(`Ticket ${data.ticket?.ticketId} created!`);
      setShowCreate(false);
      setFormData({ ...EMPTY_FORM });
      setAttachments([]);
      refresh();
      openTicket(data.ticket._id);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not create ticket');
    } finally {
      setCreating(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${selectedTicket}/messages`, { message: newMessage.trim() });
      setNewMessage('');
      setTicketRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not send reply');
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Support Center</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Get help from our support team</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> New Ticket
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Total Tickets"  value={stats.total}      color="blue"   active={statusFilter === 'all'}         onClick={() => setStatusFilter('all')} />
        <StatsCard label="Open"           value={stats.open}       color="blue"   active={statusFilter === 'open'}        onClick={() => setStatusFilter('open')}        badge={stats.unread} />
        <StatsCard label="In Progress"    value={stats.inProgress} color="yellow" active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')} />
        <StatsCard label="Resolved"       value={stats.resolved}   color="green"  active={statusFilter === 'resolved'}    onClick={() => setStatusFilter('resolved')} />
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input w-full pl-9"
              placeholder="Search tickets…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400">
                <X size={13} />
              </button>
            )}
          </div>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="sm:hidden btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Filter size={14} /> Filters
          </button>
          {/* Desktop category dropdown */}
          <select
            className="input hidden sm:block w-44"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Desktop status tabs */}
        <div className="hidden sm:flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-500 hover:bg-secondary-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile filters */}
        {showFilters && (
          <div className="sm:hidden grid grid-cols-2 gap-2">
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Ticket list */}
      {listLoading
        ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        : filteredTickets.length === 0
          ? (
            <div className="card p-14 text-center text-secondary-400">
              <HelpCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tickets found</p>
              <p className="text-sm mt-1">
                {allTickets.length === 0
                  ? 'Open your first ticket to get help from our support team'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          )
          : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary-50 border-b border-secondary-200">
                    <tr>
                      {['Ticket', 'Category', 'Status', 'Priority', 'Updated', 'Action'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {filteredTickets.map((t) => {
                      const hasNew = t.lastResponseBy === 'support' && !t.userViewed;
                      return (
                        <tr key={t._id} className="hover:bg-secondary-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium line-clamp-1">{t.subject}</p>
                            <p className="text-xs text-secondary-400 font-mono mt-0.5">#{t.ticketId}</p>
                            {hasNew && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold animate-pulse mt-0.5">
                                <Bell size={11} /> New Reply
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-secondary-500 capitalize">
                            {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                          <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                          <td className="px-4 py-3 text-secondary-400 whitespace-nowrap">
                            <p>{formatDate(t.updatedAt || t.createdAt)}</p>
                            {t.messages?.length > 0 && (
                              <p className="text-xs">{t.messages.length} repl{t.messages.length === 1 ? 'y' : 'ies'}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => openTicket(t._id)} className="text-primary-600 hover:underline flex items-center gap-1 text-sm font-medium">
                              View <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden grid gap-3">
                {filteredTickets.map((t) => {
                  const hasNew = t.lastResponseBy === 'support' && !t.userViewed;
                  return (
                    <button
                      key={t._id}
                      onClick={() => openTicket(t._id)}
                      className="card p-4 text-left w-full hover:bg-secondary-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm line-clamp-2 flex-1">{t.subject}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-secondary-400">
                        <span className="font-mono">#{t.ticketId}</span>
                        <PriorityBadge priority={t.priority} />
                        <span>{formatDate(t.updatedAt || t.createdAt)}</span>
                      </div>
                      {hasNew && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold animate-pulse mt-2">
                          <Bell size={11} /> New Reply
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )
      }

      {/* Quick help */}
      <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-primary-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Need Quick Help?</p>
            <p className="text-xs text-secondary-400">Contact our support team for immediate assistance</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href="mailto:support@macgly.com" className="btn-secondary flex items-center gap-2 text-sm">
            <Mail size={14} /> Email
          </a>
          <a href="tel:+911234567890" className="btn-secondary flex items-center gap-2 text-sm">
            <Phone size={14} /> Call
          </a>
        </div>
      </div>

      {/* ── Create Ticket Modal ───────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFormData({ ...EMPTY_FORM }); setAttachments([]); }} title="New Support Ticket" size="lg">
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input
              className="input w-full"
              placeholder="Brief description of your issue"
              value={formData.subject}
              onChange={(e) => setFormData((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select className="input w-full" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select className="input w-full" value={formData.priority} onChange={(e) => setFormData((f) => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              className="input w-full resize-none"
              rows={5}
              placeholder="Describe your issue in detail…"
              value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium mb-2">Attachments</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx"
              onChange={handleFileAttach}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {uploading ? 'Uploading…' : 'Attach Files'}
            </button>
            <p className="text-xs text-secondary-400 mt-1">Images, PDF, DOC — max 10MB each</p>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-secondary-600">
                    <Paperclip size={11} />
                    <a href={url} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-xs">{url.split('/').pop()}</a>
                    <button type="button" onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
            <Button type="submit" loading={creating}>
              <Send size={14} /> Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── View Ticket Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={!!selectedTicket}
        onClose={closeTicket}
        title={ticket ? `#${ticket.ticketId} — ${ticket.subject}` : 'Loading…'}
        size="xl"
      >
        {detailLoading || !ticket
          ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          : (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-secondary-50 border border-secondary-200">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs text-secondary-500 capitalize">
                  {CATEGORIES.find((c) => c.value === ticket.category)?.label || ticket.category}
                </span>
                {ticket.assignedTo && (
                  <span className="text-xs text-secondary-500">
                    Assigned to: <strong>{ticket.assignedTo.name}</strong>
                  </span>
                )}
              </div>

              {/* Original request */}
              <div className="p-4 rounded-xl border border-secondary-200 bg-secondary-50">
                <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-2">Original Request</p>
                <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">
                  {ticket.messages?.[0]?.content || '—'}
                </p>
                {ticket.attachments?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ticket.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                        <Paperclip size={11} /> Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Conversation thread */}
              {ticket.messages?.length > 1 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Conversation</p>
                  {ticket.messages.slice(1).map((msg, i) => {
                    const isSupport = msg.senderRole === 'support';
                    return (
                      <div key={i} className={`flex gap-3 ${isSupport ? '' : 'flex-row-reverse'}`}>
                        <Avatar name={isSupport ? 'S' : 'Y'} role={msg.senderRole} />
                        <div className={`flex-1 max-w-[80%] ${isSupport ? '' : 'items-end'}`}>
                          <div className={`rounded-xl p-3 text-sm ${isSupport ? 'bg-primary-50 border border-primary-100' : 'bg-white border border-secondary-200'}`}>
                            <p className={`text-xs font-bold mb-1 ${isSupport ? 'text-primary-600' : 'text-secondary-500'}`}>
                              {isSupport ? 'Support Team' : 'You'}
                            </p>
                            <p className="text-secondary-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            {msg.attachments?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {msg.attachments.map((url, j) => (
                                  <a key={j} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                                    <Paperclip size={10} /> Attachment
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-secondary-400 mt-1 px-1">
                            {new Date(msg.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply form */}
              {ticket.status !== 'closed'
                ? (
                  <form onSubmit={handleSendMessage} className="flex gap-3 pt-2 border-t border-secondary-100">
                    <textarea
                      className="input flex-1 resize-none"
                      rows={3}
                      placeholder="Type your reply…"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      required
                    />
                    <Button type="submit" loading={sending} disabled={!newMessage.trim()} className="self-end">
                      <Send size={14} />
                    </Button>
                  </form>
                )
                : (
                  <div className="pt-3 border-t border-secondary-100 text-center text-sm text-secondary-400">
                    This ticket is closed.{' '}
                    <button
                      onClick={() => { closeTicket(); setShowCreate(true); }}
                      className="text-primary-600 hover:underline"
                    >
                      Create a new ticket
                    </button>{' '}
                    if you need further assistance.
                  </div>
                )
              }
            </div>
          )
        }
      </Modal>
    </div>
  );
}
