import { useState } from 'react';
import { Mail, Trash2, CheckCircle, Inbox } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminContactSubmissions() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-contacts', unreadOnly, page, rev],
    () => api.get('/admin/contact-submissions', { params: { unreadOnly: unreadOnly || undefined, page, limit: 20 } }).then((r) => r.data)
  );

  const submissions = data?.submissions || [];
  const pagination = data?.pagination || {};

  async function markRead(id) {
    try {
      await api.patch(`/admin/contact-submissions/${id}/read`);
      setRev((r) => r + 1);
      if (selected?._id === id) setSelected((s) => s ? { ...s, isRead: true } : null);
    } catch { toast.error('Could not mark as read'); }
  }

  async function del(id) {
    if (!confirm('Delete this submission?')) return;
    try {
      await api.delete(`/admin/contact-submissions/${id}`);
      toast.success('Deleted');
      setSelected(null);
      setRev((r) => r + 1);
    } catch { toast.error('Could not delete'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contact Submissions</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Messages from the contact form</p>
        </div>
        <button
          onClick={() => { setUnreadOnly((v) => !v); setPage(1); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${unreadOnly ? 'bg-blue-100 border-blue-200 text-blue-700' : 'border-secondary-200 text-secondary-600 hover:bg-secondary-50'}`}
        >
          <Mail size={14} />
          {unreadOnly ? 'Unread only' : 'All messages'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : submissions.length === 0 ? (
            <div className="p-14 text-center text-secondary-400">
              <Inbox size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No submissions</p>
            </div>
          ) : (
            <div className="divide-y divide-secondary-100">
              {submissions.map((s) => (
                <div
                  key={s._id}
                  className={`px-4 py-3 cursor-pointer hover:bg-secondary-50 transition-colors ${selected?._id === s._id ? 'bg-blue-50 border-l-2 border-blue-500' : ''} ${!s.isRead ? 'font-semibold' : ''}`}
                  onClick={() => { setSelected(s); if (!s.isRead) markRead(s._id); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm line-clamp-1">{s.name} · <span className="text-secondary-400 font-normal text-xs">{s.email}</span></p>
                      <p className="text-xs text-secondary-500 line-clamp-1 mt-0.5">{s.subject || '(no subject)'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!s.isRead && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />}
                      <span className="text-xs text-secondary-400">{new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-xs text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-2 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-2 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        {selected ? (
          <div className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-base">{selected.subject || '(no subject)'}</h3>
                <p className="text-sm text-secondary-500 mt-0.5">{selected.name} · {selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{fmtDate(selected.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!selected.isRead && (
                  <button onClick={() => markRead(selected._id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <CheckCircle size={13} /> Mark read
                  </button>
                )}
                <button onClick={() => del(selected._id)} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
            <div className="bg-secondary-50 rounded-lg p-4 text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">
              {selected.message}
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center text-secondary-400 flex flex-col items-center justify-center">
            <Mail size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Select a message to read</p>
          </div>
        )}
      </div>
    </div>
  );
}
