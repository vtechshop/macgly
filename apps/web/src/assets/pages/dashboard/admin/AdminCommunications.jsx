import { useState } from 'react';
import { Send, Clock } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminCommunications() {
  const [to, setTo] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-comm-history', rev],
    () => api.get('/admin/communications/history').then((r) => r.data)
  );

  const history = data?.history || [];

  async function handleSend(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return toast.error('Subject and message required');
    setSending(true);
    try {
      const res = await api.post('/admin/communications/send', { to, subject, message });
      toast.success(`Sent to ${res.data.sent} of ${res.data.total} users`);
      setSubject('');
      setMessage('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Send bulk emails to your users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose form */}
        <form onSubmit={handleSend} className="card p-5 space-y-4">
          <h2 className="font-semibold text-base">Compose Email</h2>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Send to</label>
            <select className="input w-full" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="all">Everyone (all users)</option>
              <option value="customers">Customers only</option>
              <option value="vendors">Vendors only</option>
              <option value="affiliates">Affiliates only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Subject</label>
            <input
              className="input w-full"
              placeholder="Email subject line…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Message</label>
            <textarea
              className="input w-full resize-none"
              rows={6}
              placeholder="Write your message here…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <p className="text-xs text-secondary-400 mt-1">Line breaks will be converted to HTML line breaks</p>
          </div>

          <button type="submit" disabled={sending} className="btn-primary flex items-center gap-2 w-full justify-center">
            {sending ? <Spinner size="sm" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Email Blast'}
          </button>
        </form>

        {/* History */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-secondary-100 flex items-center gap-2 font-semibold text-sm">
            <Clock size={14} className="text-secondary-400" />
            Send History
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : history.length === 0 ? (
            <p className="text-center py-10 text-secondary-400 text-sm">No emails sent yet</p>
          ) : (
            <div className="divide-y divide-secondary-100 max-h-[520px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="px-4 py-3 hover:bg-secondary-50">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm line-clamp-1">{h.subject}</p>
                    <span className="text-xs text-secondary-400 shrink-0">{fmtDate(h.sentAt)}</span>
                  </div>
                  <p className="text-xs text-secondary-500 line-clamp-2 mb-1">{h.message}</p>
                  <div className="flex items-center gap-3 text-xs text-secondary-400">
                    <span className="capitalize">To: <strong className="text-secondary-600">{h.to}</strong></span>
                    <span className={`font-semibold ${h.sent === h.total ? 'text-green-600' : 'text-yellow-600'}`}>
                      {h.sent}/{h.total} delivered
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
