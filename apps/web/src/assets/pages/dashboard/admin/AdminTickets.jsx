import { useState } from 'react';
import { ArrowLeft, Send, ChevronDown } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatDate } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

const STATUS_CONFIG = {
  open:        { label: 'Open',        class: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', class: 'bg-yellow-100 text-yellow-700' },
  resolved:    { label: 'Resolved',    class: 'bg-green-100 text-green-700' },
  closed:      { label: 'Closed',      class: 'bg-secondary-100 text-secondary-500' },
};

const PRIORITY_CONFIG = {
  low:    'bg-secondary-100 text-secondary-600',
  medium: 'bg-blue-100 text-blue-600',
  high:   'bg-red-100 text-red-600',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>;
}

function PriorityBadge({ priority }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium}`}>
      {priority}
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Ticket Detail ────────────────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }) {
  const [rev, setRev] = useState(0);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useFetch(
    ['admin-ticket', ticketId, rev],
    () => api.get(`/admin/tickets/${ticketId}`).then((r) => r.data)
  );

  const ticket = data?.ticket;

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim() && !status) return toast.error('Enter a reply or change the status');
    setSending(true);
    try {
      await api.post(`/admin/tickets/${ticketId}/reply`, {
        message: reply.trim() || undefined,
        status: status || undefined,
      });
      setReply('');
      setStatus('');
      setRev((r) => r + 1);
      toast.success('Reply sent');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not send reply');
    } finally {
      setSending(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="text-center py-20 text-secondary-400">Ticket not found</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors mt-0.5">
          <ArrowLeft size={18} className="text-secondary-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-secondary-400">{ticket.ticketId}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs text-secondary-400 capitalize">{ticket.category?.replace('_', ' ')}</span>
          </div>
          <h2 className="font-bold text-lg">{ticket.subject}</h2>
          <p className="text-sm text-secondary-500 mt-0.5">
            From: <span className="font-medium text-secondary-700">{ticket.user?.name}</span>
            {' '}·{' '}<span className="text-secondary-400">{ticket.user?.email}</span>
            {' '}·{' '}<span className="capitalize text-secondary-400">{ticket.user?.role}</span>
            {' '}·{' '}{formatTime(ticket.createdAt)}
          </p>
        </div>
      </div>

      {/* Thread */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-secondary-100">
          {ticket.messages.map((msg, i) => (
            <div key={i} className={`p-5 ${msg.senderRole === 'support' ? 'bg-primary-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${msg.senderRole === 'support' ? 'text-primary-600' : 'text-secondary-500'}`}>
                  {msg.senderRole === 'support' ? 'Support (You)' : ticket.user?.name || 'User'}
                </span>
                <span className="text-xs text-secondary-400">{formatTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reply + status */}
      <form onSubmit={handleReply} className="card p-5 space-y-4">
        <p className="font-semibold text-sm">Reply to this ticket</p>
        <textarea
          className="input w-full resize-none"
          rows={4}
          placeholder="Type your reply to the user…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary-600">Change status:</label>
            <select
              className="input py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">— keep current ({ticket.status}) —</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={sending || (!reply.trim() && !status)}
            className="btn-primary flex items-center gap-2 ml-auto"
          >
            {sending ? <Spinner size="sm" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Ticket List ──────────────────────────────────────────────────────────────
export default function AdminTickets() {
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-tickets', statusFilter, rev],
    () => api.get('/admin/tickets', { params: { status: statusFilter || undefined, limit: 50 } }).then((r) => r.data)
  );

  if (view === 'detail') {
    return (
      <TicketDetail
        ticketId={selectedId}
        onBack={() => { setView('list'); setRev((r) => r + 1); }}
      />
    );
  }

  const tickets = data?.tickets || [];
  const counts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Tickets from customers, vendors, and affiliates</p>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
          {[['', 'All'], ['open', 'Open'], ['in_progress', 'In Progress'], ['resolved', 'Resolved'], ['closed', 'Closed']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${statusFilter === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}
            >
              {label}
              {val === '' && data?.pagination?.total ? ` (${data.pagination.total})` : ''}
              {val && counts[val] ? ` (${counts[val]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <p className="font-medium">No tickets{statusFilter ? ` with status "${statusFilter.replace('_', ' ')}"` : ''}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {tickets.map((t) => (
                <tr
                  key={t._id}
                  className="hover:bg-secondary-50 cursor-pointer transition-colors"
                  onClick={() => { setSelectedId(t._id); setView('detail'); }}
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-secondary-400">{t.ticketId}</p>
                    <p className="font-medium line-clamp-1 mt-0.5">{t.subject}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.user?.name || '—'}</p>
                    <p className="text-xs text-secondary-400 capitalize">{t.user?.role}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-secondary-600">{t.category?.replace('_', ' ')}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-secondary-500 text-xs whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
