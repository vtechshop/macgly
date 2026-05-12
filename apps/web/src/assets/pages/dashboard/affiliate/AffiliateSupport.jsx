import { useState } from 'react';
import {
  Plus, ArrowLeft, Send, Clock, CheckCircle2,
  Loader2, AlertCircle, XCircle, ChevronDown, HelpCircle,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  open:        { label: 'Open',        class: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', class: 'bg-yellow-100 text-yellow-700' },
  resolved:    { label: 'Resolved',    class: 'bg-green-100 text-green-700' },
  closed:      { label: 'Closed',      class: 'bg-secondary-100 text-secondary-500' },
};

const CATEGORIES = [
  { value: 'payment',    label: 'Payment / Payout' },
  { value: 'commission', label: 'Commission Issue' },
  { value: 'kyc',        label: 'KYC Verification' },
  { value: 'links',      label: 'Affiliate Links' },
  { value: 'technical',  label: 'Technical Problem' },
  { value: 'other',      label: 'Other' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High — urgent issue' },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Create Ticket Form ───────────────────────────────────────────────────────
function NewTicketForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ subject: '', category: 'other', priority: 'medium', message: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return toast.error('Subject and message are required');
    setSaving(true);
    try {
      const { data } = await api.post('/tickets', form);
      toast.success(`Ticket ${data.ticket.ticketId} created!`);
      onCreated(data.ticket);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not create ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-secondary-500" />
        </button>
        <div>
          <h2 className="font-bold text-lg">New Support Ticket</h2>
          <p className="text-xs text-secondary-500">We typically respond within 1 business day</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject <span className="text-red-500">*</span></label>
          <input
            className="input w-full"
            placeholder="Brief description of your issue"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select className="input w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message <span className="text-red-500">*</span></label>
          <textarea
            className="input w-full resize-none"
            rows={6}
            placeholder="Describe your issue in detail. Include any relevant order IDs, dates, or amounts…"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Spinner size="sm" /> : <Send size={14} />}
            {saving ? 'Submitting…' : 'Submit Ticket'}
          </button>
          <button type="button" onClick={onCancel} className="btn border border-secondary-200 text-secondary-700 hover:bg-secondary-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Ticket Detail ────────────────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }) {
  const [rev, setRev] = useState(0);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useFetch(
    ['ticket-detail', ticketId, rev],
    () => api.get(`/tickets/${ticketId}`).then((r) => r.data)
  );

  const ticket = data?.ticket;

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${ticketId}/reply`, { message: reply.trim() });
      setReply('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not send reply');
    } finally {
      setSending(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="text-center py-20 text-secondary-400">Ticket not found</div>;

  const isClosed = ticket.status === 'closed';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-secondary-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-secondary-400">{ticket.ticketId}</span>
            <StatusBadge status={ticket.status} />
            <span className="text-xs text-secondary-400 capitalize">{ticket.category?.replace('_', ' ')}</span>
          </div>
          <h2 className="font-bold text-lg line-clamp-1 mt-0.5">{ticket.subject}</h2>
        </div>
      </div>

      {/* Message thread */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-secondary-100">
          {ticket.messages.map((msg, i) => (
            <div key={i} className={`p-5 ${msg.senderRole === 'support' ? 'bg-primary-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${msg.senderRole === 'support' ? 'text-primary-600' : 'text-secondary-500'}`}>
                  {msg.senderRole === 'support' ? 'Macgly Support' : 'You'}
                </span>
                <span className="text-xs text-secondary-400">{formatTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reply box */}
      {!isClosed ? (
        <form onSubmit={handleReply} className="card p-5 space-y-3">
          <p className="text-sm font-medium">Add a Reply</p>
          <textarea
            className="input w-full resize-none"
            rows={4}
            placeholder="Type your reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            required
          />
          <button type="submit" disabled={sending || !reply.trim()} className="btn-primary flex items-center gap-2">
            {sending ? <Spinner size="sm" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Reply'}
          </button>
        </form>
      ) : (
        <div className="card p-4 text-center text-secondary-400 text-sm">
          This ticket is closed. Open a new ticket if you need further help.
        </div>
      )}
    </div>
  );
}

// ─── Ticket List ──────────────────────────────────────────────────────────────
function TicketList({ onSelect, onNew, rev }) {
  const { data, isLoading } = useFetch(
    ['tickets', rev],
    () => api.get('/tickets').then((r) => r.data)
  );

  const tickets = data?.tickets || [];

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Raise a ticket and track your support requests</p>
        </div>
        <button onClick={onNew} className="btn-primary flex items-center gap-2">
          <Plus size={15} />
          New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="card p-14 text-center space-y-3">
          <HelpCircle size={40} className="mx-auto text-secondary-200" />
          <p className="font-medium text-secondary-500">No tickets yet</p>
          <p className="text-sm text-secondary-400">Have an issue? Open a ticket and our team will help you out.</p>
          <button onClick={onNew} className="btn-primary inline-flex items-center gap-2 mx-auto mt-2">
            <Plus size={14} />
            Open First Ticket
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-secondary-100">
            {tickets.map((t) => (
              <button
                key={t._id}
                onClick={() => onSelect(t._id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-secondary-400">{t.ticketId}</span>
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-secondary-400 capitalize">{t.category?.replace('_', ' ')}</span>
                  </div>
                  <p className="font-medium text-sm line-clamp-1">{t.subject}</p>
                  <p className="text-xs text-secondary-400 mt-0.5">{formatTime(t.createdAt)}</p>
                </div>
                <ChevronDown size={15} className="text-secondary-300 shrink-0 -rotate-90" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAQ accordion */}
      <FaqSection />
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  { q: 'When do I get paid?', a: 'Commissions are credited once an order reaches "Delivered" status. Payouts are processed on the 1st of every month to your verified bank account after KYC approval.' },
  { q: 'How long does my referral cookie last?', a: 'When someone clicks your affiliate link, a 30-day tracking cookie is set. If they purchase within 30 days, the sale is attributed to you.' },
  { q: 'What is the commission rate?', a: 'The default rate is 5% of the order total. High-performing affiliates may be eligible for a higher rate — contact support to discuss.' },
  { q: 'Why do I need KYC?', a: 'KYC is required by Indian law for financial payouts. We need your PAN card for TDS deduction and bank details to transfer your earnings.' },
  { q: 'What happens if an order is cancelled?', a: 'Commission is only credited for delivered orders. Cancelled or returned orders have their pending commission removed.' },
];

function FaqSection() {
  const [open, setOpen] = useState(null);
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle size={17} className="text-primary-600" />
        <h2 className="font-bold">Frequently Asked Questions</h2>
      </div>
      <div>
        {FAQ.map((item, i) => (
          <div key={i} className="border-b border-secondary-100 last:border-0">
            <button
              className="w-full flex items-center justify-between py-3.5 text-left"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="text-sm font-medium pr-4">{item.q}</span>
              <ChevronDown size={14} className={`text-secondary-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <p className="text-sm text-secondary-500 pb-4 leading-relaxed">{item.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AffiliateSupport() {
  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
  const [selectedId, setSelectedId] = useState(null);
  const [listRev, setListRev] = useState(0);

  function openTicket(id) {
    setSelectedId(id);
    setView('detail');
  }

  function onCreated(ticket) {
    setListRev((r) => r + 1);
    setSelectedId(ticket._id);
    setView('detail');
  }

  if (view === 'new') {
    return <NewTicketForm onCreated={onCreated} onCancel={() => setView('list')} />;
  }
  if (view === 'detail') {
    return <TicketDetail ticketId={selectedId} onBack={() => { setView('list'); setListRev((r) => r + 1); }} />;
  }
  return <TicketList onSelect={openTicket} onNew={() => setView('new')} rev={listRev} />;
}
