import { useState } from 'react';
import { Trash2, Mail } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

export default function AdminNewsletter() {
  const [page, setPage] = useState(1);
  const [active, setActive] = useState('');
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-newsletter', active, page, rev],
    () => api.get('/admin/newsletter', { params: { active: active || undefined, page, limit: 50 } }).then((r) => r.data)
  );

  const subscribers = data?.subscribers || [];
  const pagination = data?.pagination || {};
  const activeCount = data?.activeCount || 0;

  async function del(id) {
    if (!confirm('Remove subscriber?')) return;
    try { await api.delete(`/admin/newsletter/${id}`); toast.success('Removed'); setRev((r) => r + 1); }
    catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Newsletter</h1>
          <p className="text-secondary-500 text-sm mt-0.5"><strong>{activeCount.toLocaleString()}</strong> active subscribers</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
          {[['', 'All'], ['true', 'Active'], ['false', 'Unsubscribed']].map(([val, label]) => (
            <button key={val} onClick={() => { setActive(val); setPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${active === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>{label}</button>
          ))}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <div className="card overflow-hidden">
          {subscribers.length === 0 ? (
            <div className="p-14 text-center text-secondary-400"><Mail size={40} className="mx-auto mb-3 opacity-30" /><p>No subscribers</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-left">Subscribed</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {subscribers.map((s) => (
                  <tr key={s._id} className="hover:bg-secondary-50">
                    <td className="px-4 py-3 font-medium">{s.email}</td>
                    <td className="px-4 py-3 text-secondary-600">{s.name || '—'}</td>
                    <td className="px-4 py-3 text-secondary-400 capitalize text-xs">{s.source}</td>
                    <td className="px-4 py-3 text-secondary-400 text-xs">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>{s.isActive ? 'Active' : 'Unsubscribed'}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => del(s._id)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><Trash2 size={13} className="text-red-500" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
