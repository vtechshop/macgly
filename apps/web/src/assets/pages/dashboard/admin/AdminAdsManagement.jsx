import { useState } from 'react';
import { Megaphone, CheckCircle, XCircle } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', active: 'bg-green-100 text-green-700', paused: 'bg-secondary-100 text-secondary-500', rejected: 'bg-red-100 text-red-700', completed: 'bg-blue-100 text-blue-700' };

export default function AdminAdsManagement() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-ads', status, page, rev],
    () => api.get('/admin/ads', { params: { status: status || undefined, page, limit: 30 } }).then((r) => r.data)
  );

  const campaigns = data?.campaigns || [];
  const pagination = data?.pagination || {};

  async function updateStatus(id, newStatus, adminNote) {
    try {
      await api.patch(`/admin/ads/${id}/status`, { status: newStatus, adminNote });
      toast.success(`Campaign ${newStatus}`);
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Ad Campaigns</h1><p className="text-secondary-500 text-sm mt-0.5">Review and manage vendor sponsored ads</p></div>
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
          {[['pending', 'Pending'], ['active', 'Active'], ['rejected', 'Rejected'], ['', 'All']].map(([val, label]) => (
            <button key={val} onClick={() => { setStatus(val); setPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${status === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>{label}</button>
          ))}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : campaigns.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400"><Megaphone size={40} className="mx-auto mb-3 opacity-30" /><p>No campaigns</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Campaign</th><th className="px-4 py-3 text-left">Vendor</th><th className="px-4 py-3 text-right">Budget</th><th className="px-4 py-3 text-left">Placement</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {campaigns.map((c) => (
                <tr key={c._id} className="hover:bg-secondary-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">{c.product?.images?.[0] && <img src={c.product.images[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}<div><p className="font-medium">{c.title}</p><p className="text-xs text-secondary-400">{c.product?.title}</p></div></div>
                  </td>
                  <td className="px-4 py-3"><p className="font-medium">{c.vendor?.name}</p><p className="text-xs text-secondary-400">{c.vendor?.email}</p></td>
                  <td className="px-4 py-3 text-right font-medium">₹{(c.budget || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize text-secondary-600">{c.placement}</td>
                  <td className="px-4 py-3 text-secondary-400 text-xs">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span></td>
                  <td className="px-4 py-3">
                    {c.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateStatus(c._id, 'active')} className="p-1.5 hover:bg-green-50 rounded-lg" title="Approve"><CheckCircle size={15} className="text-green-600" /></button>
                        <button onClick={() => { const note = prompt('Rejection reason:'); if (note !== null) updateStatus(c._id, 'rejected', note); }} className="p-1.5 hover:bg-red-50 rounded-lg" title="Reject"><XCircle size={15} className="text-red-500" /></button>
                      </div>
                    )}
                    {c.status === 'active' && (
                      <button onClick={() => updateStatus(c._id, 'paused')} className="text-xs text-secondary-500 hover:underline">Pause</button>
                    )}
                    {c.status === 'paused' && (
                      <button onClick={() => updateStatus(c._id, 'active')} className="text-xs text-green-600 hover:underline">Resume</button>
                    )}
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
