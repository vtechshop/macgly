import { useState } from 'react';
import {
  MessageSquare, AlertCircle, CheckCircle, Clock, TrendingUp, Timer,
  Search, Download, RefreshCw, Eye, Reply, Trash2, X, Send,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  new:      { label: 'New',      class: 'bg-blue-100 text-blue-700' },
  read:     { label: 'Read',     class: 'bg-secondary-100 text-secondary-500' },
  replied:  { label: 'Replied',  class: 'bg-green-100 text-green-700' },
  resolved: { label: 'Resolved', class: 'bg-purple-100 text-purple-700' },
  spam:     { label: 'Spam',     class: 'bg-red-100 text-red-600' },
};

const REPLY_TEMPLATES = [
  { id: 'thanks',   label: 'Thank You',      text: 'Thank you for contacting us. We have received your message and will respond within 24 hours.' },
  { id: 'received', label: 'Received',        text: 'We have received your inquiry and our team is looking into it. We will get back to you shortly.' },
  { id: 'info',     label: 'Need More Info',  text: 'Thank you for reaching out. To better assist you, could you please provide more details about your inquiry?' },
  { id: 'resolved', label: 'Issue Resolved',  text: 'We are pleased to inform you that your inquiry has been resolved. Please let us know if you need any further assistance.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function fmtDateTime(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

function getUrgency(createdAt, status) {
  if (status !== 'new' && status !== 'read') return null;
  const hours = (Date.now() - new Date(createdAt)) / 3600000;
  if (hours < 4)  return { label: 'New',  class: 'bg-blue-100 text-blue-600' };
  if (hours < 24) return { label: `${Math.floor(hours)}h`, class: 'bg-green-100 text-green-600' };
  if (hours < 48) return { label: '1d+',  class: 'bg-yellow-100 text-yellow-600' };
  return               { label: `${Math.floor(hours / 24)}d`, class: 'bg-red-100 text-red-600' };
}

// ─── View/Reply Modal ─────────────────────────────────────────────────────────
function SubmissionModal({ submissionId, onClose, onUpdate }) {
  const [rev, setRev] = useState(0);
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const { data, isLoading } = useFetch(
    ['contact-submission', submissionId, rev],
    () => api.get(`/admin/contact-submissions/${submissionId}`).then((r) => r.data)
  );
  const s = data?.data || data?.submission;

  async function changeStatus(status) {
    setUpdating(true);
    try {
      await api.put(`/admin/contact-submissions/${submissionId}/status`, { status });
      setRev((r) => r + 1);
      onUpdate();
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  async function sendReply() {
    if (!replyText.trim()) return toast.error('Enter a reply message');
    setSending(true);
    try {
      await api.post(`/admin/contact-submissions/${submissionId}/reply`, { message: replyText.trim() });
      setReplyText('');
      setReplyMode(false);
      setRev((r) => r + 1);
      onUpdate();
      toast.success('Reply sent');
    } catch { toast.error('Failed to send reply'); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <div>
            <p className="font-bold">Contact Submission</p>
            {s && <p className="text-xs text-secondary-400 font-mono">…{String(s._id).slice(-8)}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary-100 rounded-lg"><X size={18} className="text-secondary-400" /></button>
        </div>

        {isLoading || !s ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Status buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(STATUS_CFG).map(([val, { label }]) => (
                <button
                  key={val}
                  onClick={() => changeStatus(val)}
                  disabled={updating}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${s.status === val ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Customer info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Name',     value: s.name },
                { label: 'Email',    value: <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a> },
                { label: 'Subject',  value: s.subject || '(no subject)' },
                { label: 'Received', value: fmtDateTime(s.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-secondary-50 rounded-xl p-3">
                  <p className="text-xs text-secondary-400 mb-1">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>

            {/* Message */}
            <div>
              <p className="text-xs text-secondary-400 mb-1">Message</p>
              <div className="bg-blue-50 rounded-xl p-4 text-secondary-700 whitespace-pre-wrap leading-relaxed text-sm">
                {s.message}
              </div>
            </div>

            {/* Previous replies */}
            {s.replies?.length > 0 && (
              <div>
                <p className="text-xs text-secondary-400 mb-2">Previous Replies ({s.replies.length})</p>
                <div className="space-y-2">
                  {s.replies.map((r, i) => (
                    <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-green-700">Admin Reply</span>
                        <span className="text-xs text-secondary-400">{fmtDateTime(r.createdAt)}</span>
                      </div>
                      <p className="text-secondary-700 whitespace-pre-wrap">{r.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply section */}
            {!replyMode ? (
              <button onClick={() => setReplyMode(true)} className="btn flex items-center gap-2 text-sm w-full justify-center">
                <Reply size={14} /> Reply to this submission
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">Reply</p>
                {/* Quick templates */}
                <div className="flex flex-wrap gap-1.5">
                  {REPLY_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setReplyText(t.text)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-secondary-100 text-secondary-600 hover:bg-secondary-200 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input w-full resize-none text-sm"
                  rows={5}
                  placeholder="Type your reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setReplyMode(false); setReplyText(''); }} className="btn text-sm">Cancel</button>
                  <button onClick={sendReply} disabled={sending || !replyText.trim()} className="btn-primary flex items-center gap-2 text-sm">
                    {sending ? <Spinner size="sm" /> : <Send size={13} />}
                    {sending ? 'Sending…' : 'Send Reply →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminContactSubmissions() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('new');
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewingId, setViewingId] = useState(null);
  const [listRev, setListRev] = useState(0);
  const [statsRev, setStatsRev] = useState(0);

  const { data: statsData } = useFetch(
    ['contact-stats', statsRev],
    () => api.get('/admin/contact-submissions/stats').then((r) => r.data)
  );

  const { data, isLoading } = useFetch(
    ['contact-list', activeTab, search, page, listRev],
    () => api.get('/admin/contact-submissions', {
      params: { status: activeTab || undefined, search: search || undefined, page, limit: 20 },
    }).then((r) => r.data)
  );

  const stats = statsData?.data || {};
  const submissions = data?.data || data?.submissions || [];
  const meta = data?.meta || data?.pagination || {};

  const refresh = () => { setListRev((r) => r + 1); setStatsRev((r) => r + 1); };

  const allSelected = submissions.length > 0 && submissions.every((s) => selectedItems.includes(s._id));
  function toggleAll(v) { setSelectedItems(v ? submissions.map((s) => s._id) : []); }
  function toggleOne(id) { setSelectedItems((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }

  async function bulkAction(status) {
    try {
      await api.post('/admin/contact-submissions/bulk-update', { ids: selectedItems, status });
      toast.success(`${selectedItems.length} updated`);
      setSelectedItems([]);
      refresh();
    } catch { toast.error('Bulk action failed'); }
  }

  async function deleteOne(id) {
    if (!confirm('Delete this submission?')) return;
    try {
      await api.delete(`/admin/contact-submissions/${id}`);
      toast.success('Deleted');
      refresh();
    } catch { toast.error('Delete failed'); }
  }

  function exportCSV() {
    const header = 'Date,Name,Email,Subject,Message,Status';
    const rows = submissions.map((s) => [
      fmtDate(s.createdAt), s.name, s.email, s.subject || '',
      (s.message || '').slice(0, 100), s.status,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contact-submissions.csv'; a.click();
  }

  const TABS = [
    { value: 'new',      label: 'New',      count: stats.new },
    { value: 'read',     label: 'Read',     count: stats.read },
    { value: 'replied',  label: 'Replied',  count: stats.replied },
    { value: 'resolved', label: 'Resolved', count: stats.resolved },
    { value: 'spam',     label: 'Spam',     count: stats.spam },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contact Submissions</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage customer inquiries and messages</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn flex items-center gap-1.5 text-sm"><RefreshCw size={13} /> Refresh</button>
          <button onClick={exportCSV} className="btn-primary flex items-center gap-1.5 text-sm"><Download size={13} /> Export CSV</button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total',          value: stats.total ?? 0,          icon: MessageSquare, color: 'blue' },
          { label: 'Needs Response', value: stats.new ?? 0,            icon: AlertCircle,   color: 'red' },
          { label: 'Replied',        value: stats.replied ?? 0,        icon: CheckCircle,   color: 'green' },
          { label: 'Resolved',       value: stats.resolved ?? 0,       icon: CheckCircle,   color: 'purple' },
          { label: 'Response Rate',  value: `${stats.responseRate ?? 0}%`, icon: TrendingUp, color: 'blue' },
          { label: 'Avg Response',   value: stats.avgResponseTime ?? 'N/A', icon: Timer,    color: 'orange' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary-500 font-medium">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'purple' ? 'text-purple-600' : color === 'blue' ? 'text-secondary-800' : 'text-orange-600'}`}>
                {value}
              </p>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-50`}>
              <Icon size={16} className={`text-${color}-500`} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-secondary-200">
        {TABS.map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => { setActiveTab(value); setPage(1); setSelectedItems([]); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-secondary-500 hover:text-secondary-800'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === value ? 'bg-blue-100 text-blue-700' : 'bg-secondary-100 text-secondary-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input pl-8 text-sm w-full"
          placeholder="Search by name, email, or subject…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Bulk actions */}
      {selectedItems.length > 0 && (
        <div className="card p-3 flex items-center gap-4 bg-blue-50 border border-blue-200">
          <span className="text-sm font-semibold text-blue-700">{selectedItems.length} selected</span>
          <button onClick={() => bulkAction('read')} className="btn text-xs py-1">Mark Read</button>
          <button onClick={() => bulkAction('resolved')} className="btn text-xs py-1">Resolve</button>
          <button onClick={() => bulkAction('spam')} className="btn text-xs py-1 text-red-600">Spam</button>
          <button onClick={() => setSelectedItems([])} className="ml-auto text-xs text-secondary-400 hover:text-secondary-600">Clear</button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : submissions.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No submissions found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
              <tr>
                <th className="px-3 py-3 w-8"><input type="checkbox" className="rounded" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>
                <th className="px-4 py-3 text-left">Urgency</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {submissions.map((s) => {
                const urgency = getUrgency(s.createdAt, s.status);
                const sc = STATUS_CFG[s.status] || STATUS_CFG.new;
                return (
                  <tr key={s._id} onClick={() => setViewingId(s._id)} className="hover:bg-secondary-50 cursor-pointer transition-colors">
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded" checked={selectedItems.includes(s._id)} onChange={() => toggleOne(s._id)} />
                    </td>
                    <td className="px-4 py-3">
                      {urgency ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${urgency.class}`}>{urgency.label}</span>
                      ) : <span className="text-secondary-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-medium ${s.status === 'new' ? 'font-semibold' : ''}`}>{s.name}</p>
                      <p className="text-xs text-secondary-400">{s.email}</p>
                      {s.status === 'new' && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-600 font-semibold">New</span>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium line-clamp-1">{s.subject || '(no subject)'}</p>
                      <p className="text-xs text-secondary-400 line-clamp-1">{s.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.class}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-500">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewingId(s._id)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="View"><Eye size={13} className="text-blue-500" /></button>
                        <button onClick={() => setViewingId(s._id)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Reply"><Reply size={13} className="text-green-600" /></button>
                        <button onClick={() => deleteOne(s._id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={13} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(meta.totalPages || meta.pages) > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {meta.page} of {meta.totalPages || meta.pages} · {meta.total} submissions</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= (meta.totalPages || meta.pages)} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewingId && (
        <SubmissionModal
          submissionId={viewingId}
          onClose={() => setViewingId(null)}
          onUpdate={refresh}
        />
      )}
    </div>
  );
}
