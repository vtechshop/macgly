import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

const STATUS_COLORS = {
  requested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  pickup_scheduled: 'bg-purple-100 text-purple-700',
  picked_up: 'bg-indigo-100 text-indigo-700',
  refunded: 'bg-green-100 text-green-700',
};

export default function AdminReturns() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [updating, setUpdating] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-returns', status, page, rev],
    () => api.get('/admin/returns', { params: { status: status || undefined, page, limit: 30 } }).then((r) => r.data)
  );
  const returns = data?.returns || [];
  const pagination = data?.pagination || {};

  async function updateStatus() {
    if (!newStatus) return toast.error('Select a status');
    setUpdating(true);
    try {
      await api.patch(`/admin/returns/${selected._id}/status`, { status: newStatus, adminNote, refundAmount: refundAmount ? parseFloat(refundAmount) : undefined });
      toast.success('Updated');
      setSelected(null); setRev((r) => r + 1);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); } finally { setUpdating(false); }
  }

  if (selected) return (
    <div className="space-y-5 max-w-xl">
      <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium"><ArrowLeft size={16} /> Back</button>
      <h2 className="text-xl font-bold">Return {selected.returnId}</h2>
      <div className="card p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-secondary-400 text-xs">Customer</p><p className="font-medium">{selected.user?.name}</p><p className="text-secondary-400 text-xs">{selected.user?.email}</p></div>
          <div><p className="text-secondary-400 text-xs">Order</p><p className="font-mono">{selected.order?.orderId}</p></div>
          <div><p className="text-secondary-400 text-xs">Reason</p><p>{selected.reason}</p></div>
          <div><p className="text-secondary-400 text-xs">Refund Amount</p><p className="font-medium">₹{(selected.refundAmount || 0).toLocaleString()}</p></div>
        </div>
        {selected.description && <p className="text-sm text-secondary-600 bg-secondary-50 p-3 rounded-lg">{selected.description}</p>}
        <hr />
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">Update Status</label>
            <select className="input w-full" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="">Select status…</option>
              {['approved', 'rejected', 'pickup_scheduled', 'picked_up', 'refunded'].map((s) => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium mb-1">Refund Amount Override</label><input className="input w-full" type="number" placeholder="Leave blank to keep original" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">Admin Note</label><textarea className="input w-full resize-none" rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} /></div>
          <button onClick={updateStatus} disabled={updating} className="btn-primary flex items-center gap-2">{updating ? <Spinner size="sm" /> : <RefreshCw size={14} />} Update</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Returns & Refunds</h1><p className="text-secondary-500 text-sm mt-0.5">Manage customer return requests</p></div>
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
          {[['', 'All'], ['requested', 'Requested'], ['approved', 'Approved'], ['refunded', 'Refunded']].map(([val, label]) => (
            <button key={val} onClick={() => { setStatus(val); setPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${status === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>{label}</button>
          ))}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <div className="card overflow-hidden">
          {returns.length === 0 ? <p className="text-center py-10 text-secondary-400 text-sm">No returns found</p> : (
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Return ID</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Order</th><th className="px-4 py-3 text-right">Refund</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-center">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {returns.map((r) => (
                  <tr key={r._id} className="hover:bg-secondary-50 cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3 font-mono text-xs">{r.returnId}</td>
                    <td className="px-4 py-3"><p className="font-medium">{r.user?.name}</p><p className="text-xs text-secondary-400">{r.user?.email}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-500">{r.order?.orderId}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{(r.refundAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-secondary-500 text-xs">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[r.status] || ''}`}>{r.status?.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
