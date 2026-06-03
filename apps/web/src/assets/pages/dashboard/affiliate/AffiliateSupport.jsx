import { useState, useMemo } from 'react';
import {
  Plus, Send, Clock, CheckCircle, XCircle, CircleDot,
  MessageSquare, Bell, Search, RefreshCw,
  FileText, Mail, Sparkles, Phone,
  X, Lightbulb, HelpCircle,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, useAction, invalidateCache } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  open:        { icon: CircleDot,    label: 'Open',        cls: 'bg-blue-100 text-blue-700' },
  in_progress: { icon: Clock,        label: 'In Progress', cls: 'bg-amber-100 text-amber-700' },
  resolved:    { icon: CheckCircle,  label: 'Resolved',    cls: 'bg-green-100 text-green-700' },
  closed:      { icon: XCircle,      label: 'Closed',      cls: 'bg-secondary-100 text-secondary-500' },
};

const PRIORITY_CFG = {
  low:    'bg-secondary-100 text-secondary-500',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-700',
};

const CATEGORIES = [
  { value: 'payment',    label: 'Payment & Commissions' },
  { value: 'commission', label: 'Commission Issues' },
  { value: 'kyc',        label: 'KYC Verification' },
  { value: 'links',      label: 'Affiliate Links' },
  { value: 'technical',  label: 'Technical Issue' },
  { value: 'other',      label: 'General Support' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const QUICK_HELP = [
  { label: 'Commission Issues',   desc: 'Questions about earnings or payouts', category: 'commission', icon: FileText,  gradient: 'from-blue-500 to-blue-600' },
  { label: 'Payment Support',     desc: 'Payment method or withdrawal help',   category: 'payment',    icon: Mail,     gradient: 'from-green-500 to-emerald-600' },
  { label: 'Marketing Materials', desc: 'Request banners and promo content',   category: 'other',      icon: Sparkles, gradient: 'from-purple-500 to-violet-600' },
  { label: 'General Support',     desc: 'Other questions or issues',           category: 'other',      icon: Phone,    gradient: 'from-orange-500 to-orange-600' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, iconCls, label, value, subtext, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left w-full transition-all hover:border-primary-300 ${active ? 'border-primary-500 ring-2 ring-primary-200' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={iconCls} />
        <span className="text-xs text-secondary-400">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-xs text-secondary-400 mt-0.5">{subtext}</p>}
    </button>
  );
}

function QuickHelpCard({ label, desc, icon: Icon, gradient, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-xl border border-secondary-200 hover:border-primary-300 hover:shadow-sm transition-all text-left group bg-white"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${gradient}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-secondary-400 mt-0.5">{desc}</p>
      </div>
      <span className="text-secondary-300 group-hover:text-primary-400 transition-colors text-sm">›</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function TicketCard({ ticket, onClick }) {
  const isUnread  = ticket.lastResponseBy === 'support' && !ticket.userViewed;
  const isAwaiting = ticket.lastResponseBy === 'user'    && !ticket.adminViewed;
  return (
    <div
      className={`card p-4 cursor-pointer hover:border-primary-300 transition-all ${isUnread ? 'border-green-300 bg-green-50/30' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Response badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge status={ticket.status} />
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${PRIORITY_CFG[ticket.priority] || PRIORITY_CFG.medium}`}>
              {ticket.priority}
            </span>
            {isUnread && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-700 animate-pulse">
                <Bell size={10} /> New Response
              </span>
            )}
            {isAwaiting && !isUnread && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Clock size={10} /> Awaiting
              </span>
            )}
          </div>

          {/* Subject */}
          <p className="text-sm font-semibold line-clamp-1">{ticket.subject}</p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1 text-xs text-secondary-400 flex-wrap">
            <span className="font-mono">#{ticket.ticketId}</span>
            <span>·</span>
            <span>{fmtTime(ticket.createdAt)}</span>
            {ticket.assignedTo?.name && (
              <>
                <span>·</span>
                <span>Assigned to {ticket.assignedTo.name}</span>
              </>
            )}
          </div>
        </div>

        <button className="shrink-0 text-xs font-medium text-primary-600 px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors">
          View
        </button>
      </div>
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ formData, onChange, onSubmit, creating, onClose }) {
  return (
    <ModalOverlay onClose={onClose} size="md">
      <div className="p-5 border-b border-secondary-100 flex items-center justify-between">
        <div>
          <h2 className="font-bold">New Support Ticket</h2>
          <p className="text-xs text-secondary-400 mt-0.5">We typically respond within 1 business day</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
          <X size={16} className="text-secondary-400" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject <span className="text-red-500">*</span></label>
          <input
            className="input w-full"
            placeholder="Brief description of your issue"
            value={formData.subject}
            onChange={(e) => onChange('subject', e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="input w-full" value={formData.category} onChange={(e) => onChange('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select className="input w-full" value={formData.priority} onChange={(e) => onChange('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description <span className="text-red-500">*</span></label>
          <textarea
            className="input w-full resize-none"
            rows={5}
            placeholder="Describe your issue in detail…"
            value={formData.description}
            onChange={(e) => onChange('description', e.target.value)}
            required
          />
        </div>

        {/* Tips */}
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Include relevant order IDs, when the issue started, and any error messages you saw. This helps our team resolve it faster.
          </p>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2">
            {creating ? <Spinner size="sm" /> : <Send size={13} />}
            {creating ? 'Submitting…' : 'Submit Ticket'}
          </button>
          <button type="button" onClick={onClose} className="btn border border-secondary-200 text-secondary-700 hover:bg-secondary-50">
            Cancel
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ ticketId, newMessage, onMessageChange, onSend, sending, onClose }) {
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['ticket', ticketId, rev],
    () => api.get(`/tickets/${ticketId}`).then((r) => r.data),
    { enabled: !!ticketId }
  );

  const ticket = data?.ticket;
  const isClosed = ticket?.status === 'closed' || ticket?.status === 'resolved';

  function handleSend(e) {
    e.preventDefault();
    onSend(ticketId, () => setRev((r) => r + 1));
  }

  return (
    <ModalOverlay onClose={onClose} size="lg">
      <div className="p-5 border-b border-secondary-100 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {ticket ? (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <StatusBadge status={ticket.status} />
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${PRIORITY_CFG[ticket.priority] || PRIORITY_CFG.medium}`}>
                  {ticket.priority}
                </span>
                <span className="text-xs text-secondary-400 capitalize">{ticket.category?.replace('_', ' ')}</span>
              </div>
              <h2 className="font-bold line-clamp-2">{ticket.subject}</h2>
              <p className="text-xs text-secondary-400 mt-0.5 font-mono">#{ticket.ticketId}</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-secondary-400">Loading ticket…</p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors shrink-0">
          <X size={16} className="text-secondary-400" />
        </button>
      </div>

      {isLoading && !ticket ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !ticket ? (
        <div className="py-16 text-center text-secondary-400 text-sm">Ticket not found</div>
      ) : (
        <>
          {/* Conversation thread */}
          <div className="divide-y divide-secondary-100 max-h-96 overflow-y-auto">
            {ticket.messages.map((msg, i) => {
              const isSupport = msg.senderRole === 'support';
              const initial   = isSupport
                ? (ticket.assignedTo?.name?.[0] || 'S').toUpperCase()
                : 'Y';
              return (
                <div key={i} className={`p-5 ${isSupport ? 'bg-blue-50' : 'bg-white sm:ml-8'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isSupport ? 'bg-blue-600 text-white' : 'bg-secondary-200 text-secondary-600'}`}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs font-semibold ${isSupport ? 'text-blue-700' : 'text-secondary-500'}`}>
                          {isSupport ? 'Support Team' : 'You'}
                        </span>
                        <span className="text-xs text-secondary-400">{fmtTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply form or closed notice */}
          <div className="p-5 border-t border-secondary-100">
            {isClosed ? (
              <div className="text-center py-4 space-y-1">
                <p className="text-sm text-secondary-500 font-medium">
                  This ticket is {ticket.status}.
                </p>
                <p className="text-xs text-secondary-400">
                  Need more help?{' '}
                  <button onClick={onClose} className="text-primary-600 hover:underline">
                    Create a new ticket
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-3">
                <textarea
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="Type your reply…"
                  value={newMessage}
                  onChange={(e) => onMessageChange(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  {sending ? <Spinner size="sm" /> : <Send size={13} />}
                  {sending ? 'Sending…' : 'Send Reply'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </ModalOverlay>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, size = 'md', children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${size === 'lg' ? 'max-w-2xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateSupport() {
  const [rev,            setRev]            = useState(0);
  const [showCreate,     setShowCreate]     = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newMessage,     setNewMessage]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [formData,       setFormData]       = useState({
    subject: '', description: '', category: 'other', priority: 'medium',
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: statsData } = useFetch(
    ['affiliate-ticket-stats', rev],
    () => api.get('/tickets/my-stats').then((r) => r.data)
  );

  const { data: ticketsData, isLoading: ticketsLoading } = useFetch(
    ['affiliate-tickets', rev],
    () => api.get('/tickets').then((r) => r.data)
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { mutate: createMutation, isPending: creating } = useAction(
    (body) => api.post('/tickets', body).then((r) => r.data),
    {
      onSuccess: (data) => {
        toast.success(`Ticket ${data.ticket?.ticketId} created!`);
        invalidateCache('affiliate-tickets');
        invalidateCache('affiliate-ticket-stats');
        setFormData({ subject: '', description: '', category: 'other', priority: 'medium' });
        setShowCreate(false);
        setRev((r) => r + 1);
        setSelectedTicket(data.ticket?._id);
      },
      onError: (err) => toast.error(err.response?.data?.error?.message || 'Could not create ticket'),
    }
  );

  const { mutate: addMessageMutation, isPending: sending } = useAction(
    ({ id, message }) => api.post(`/tickets/${id}/messages`, { message }).then((r) => r.data),
    {
      onSuccess: () => {
        invalidateCache('ticket');
        invalidateCache('affiliate-tickets');
        setNewMessage('');
        setRev((r) => r + 1);
      },
      onError: (err) => toast.error(err.response?.data?.error?.message || 'Could not send reply'),
    }
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const tickets = ticketsData?.tickets || [];
  const stats   = statsData || {};
  const active  = (stats.open || 0) + (stats.inProgress || 0);

  const filteredTickets = useMemo(() => {
    let list = tickets;
    if (statusFilter === 'active') {
      list = list.filter((t) => t.status === 'open' || t.status === 'in_progress');
    } else if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.subject?.toLowerCase().includes(q) ||
        t.ticketId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, statusFilter, searchQuery]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openCreateWithCategory(category) {
    setFormData((f) => ({ ...f, category }));
    setShowCreate(true);
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      return toast.error('Subject and description are required');
    }
    createMutation(formData);
  }

  function handleSend(id, onRefresh) {
    if (!newMessage.trim()) return;
    addMessageMutation({ id, message: newMessage.trim() });
    onRefresh();
  }

  function setField(key, val) {
    setFormData((f) => ({ ...f, [key]: val }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* 1 — Header */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-blue-200" />
            <div>
              <h1 className="text-xl font-bold">Support Center</h1>
              <p className="text-sm text-blue-200">Get help with commissions, payments, and more</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
          >
            <Plus size={15} /> New Ticket
          </button>
        </div>

        {/* Unread alert */}
        {stats.unread > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-400/30 rounded-lg text-sm">
            <Bell size={14} className="text-green-300 animate-bounce" />
            <span className="text-green-100">
              You have <strong>{stats.unread}</strong> ticket{stats.unread !== 1 ? 's' : ''} with new responses
            </span>
          </div>
        )}
      </div>

      {/* 2 — Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          icon={MessageSquare} iconCls="text-blue-500"
          label="Total Tickets" value={stats.total ?? tickets.length}
          active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}
        />
        <StatsCard
          icon={CircleDot} iconCls="text-amber-500"
          label="Active" value={active}
          subtext={`${stats.open || 0} open, ${stats.inProgress || 0} in progress`}
          active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}
        />
        <StatsCard
          icon={CheckCircle} iconCls="text-green-500"
          label="Resolved" value={stats.resolved || 0}
          active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')}
        />
        <StatsCard
          icon={XCircle} iconCls="text-red-400"
          label="Closed" value={stats.closed || 0}
          active={statusFilter === 'closed'} onClick={() => setStatusFilter('closed')}
        />
      </div>

      {/* 3 — Quick Help Topics */}
      <div>
        <p className="text-sm font-semibold mb-3">Quick Help Topics</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_HELP.map((h) => (
            <QuickHelpCard
              key={h.label}
              {...h}
              onClick={() => openCreateWithCategory(h.category)}
            />
          ))}
        </div>
      </div>

      {/* 4 — Search + Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input w-full pl-9"
            placeholder="Search tickets by subject or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => { invalidateCache('affiliate-tickets'); invalidateCache('affiliate-ticket-stats'); setRev((r) => r + 1); }}
          className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* 5 — Ticket list */}
      {ticketsLoading && !tickets.length ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filteredTickets.length === 0 ? (
        <div className="card p-14 text-center space-y-3">
          <MessageSquare size={36} className="mx-auto text-secondary-200" />
          <p className="font-medium text-secondary-500">
            {searchQuery || statusFilter !== 'all' ? 'No tickets match your filters' : 'No Support Tickets'}
          </p>
          <p className="text-sm text-secondary-400">
            {searchQuery || statusFilter !== 'all'
              ? 'Try clearing the search or filter above.'
              : "You haven't created any support tickets yet."}
          </p>
          {statusFilter === 'all' && !searchQuery && (
            <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 mx-auto mt-1">
              <Plus size={13} /> Create Your First Ticket
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <TicketCard key={t._id} ticket={t} onClick={() => { setSelectedTicket(t._id); setNewMessage(''); }} />
          ))}
        </div>
      )}

      {/* 6 — Avg response time */}
      {stats.avgResponseTime && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-secondary-200 bg-secondary-50">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
            <Clock size={14} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Average Response Time</p>
            <p className="text-xs text-secondary-400">
              Our team typically responds within <strong className="text-secondary-700">{stats.avgResponseTime}</strong>
            </p>
          </div>
        </div>
      )}

      {/* 7 — Create modal */}
      {showCreate && (
        <CreateModal
          formData={formData}
          onChange={setField}
          onSubmit={handleCreate}
          creating={creating}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* 8 — View modal */}
      {selectedTicket && (
        <ViewModal
          ticketId={selectedTicket}
          newMessage={newMessage}
          onMessageChange={setNewMessage}
          onSend={handleSend}
          sending={sending}
          onClose={() => { setSelectedTicket(null); setNewMessage(''); setRev((r) => r + 1); }}
        />
      )}

    </div>
  );
}
