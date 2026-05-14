import { useState } from 'react';
import { CheckCircle, IndianRupee, Banknote } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

export default function AdminCommissions() {
  const [type, setType] = useState('vendor');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-commissions', type, status, page, rev],
    () => api.get('/admin/commissions', { params: { type, status: status || undefined, page, limit: 30 } }).then((r) => r.data)
  );

  const commissions = data?.commissions || [];
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};

  function toggleSelect(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function toggleAll() {
    const pending = commissions.filter((c) => c.status === 'pending').map((c) => c._id);
    setSelected((s) => s.length === pending.length ? [] : pending);
  }

  async function bulkApprove() {
    if (!selected.length) return;
    setProcessing(true);
    try {
      await api.post('/admin/commissions/bulk-approve', { ids: selected });
      toast.success(`Approved ${selected.length} commissions`);
      setSelected([]);
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); } finally { setProcessing(false); }
  }

  async function markPaid(id) {
    try {
      await api.patch(`/admin/commissions/${id}/paid`, {});
      toast.success('Marked as paid');
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Approve and pay out commissions</p>
        </div>
        {selected.length > 0 && (
          <button onClick={bulkApprove} disabled={processing} className="btn-primary flex items-center gap-2">
            {processing ? <Spinner size="sm" /> : <CheckCircle size={14} />} Approve {selected.length} Selected
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Pending Payout', value: `₹${(summary.pendingAmount || 0).toLocaleString()}`, color: 'text-yellow-600' },
          { label: 'Approved (ready to pay)', value: `₹${(summary.approvedAmount || 0).toLocaleString()}`, color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4"><p className="text-xs text-secondary-400">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
          {[['vendor', 'Vendor'], ['affiliate', 'Affiliate']].map(([val, label]) => (
            <button key={val} onClick={() => { setType(val); setPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${type === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
          {[['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['paid', 'Paid']].map(([val, label]) => (
            <button key={val} onClick={() => { setStatus(val); setPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${status === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>{label}</button>
          ))}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <input type="checkbox" onChange={toggleAll} checked={selected.length > 0 && selected.length === commissions.filter((c) => c.status === 'pending').length} className="w-4 h-4" />
                </th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-right">Sale</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {commissions.map((c) => (
                <tr key={c._id} className="hover:bg-secondary-50">
                  <td className="px-4 py-3">
                    {c.status === 'pending' && <input type="checkbox" checked={selected.includes(c._id)} onChange={() => toggleSelect(c._id)} className="w-4 h-4" />}
                  </td>
                  <td className="px-4 py-3"><p className="font-medium">{c.user?.name}</p><p className="text-xs text-secondary-400">{c.user?.email}</p></td>
                  <td className="px-4 py-3 font-mono text-xs text-secondary-500">{c.order?.orderId || '—'}</td>
                  <td className="px-4 py-3 text-right">₹{(c.saleAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">₹{(c.commissionAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-secondary-500 text-xs">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-center">
                    {c.status === 'approved' && (
                      <button onClick={() => markPaid(c._id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mx-auto"><Banknote size={12} /> Pay</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length === 0 && <p className="text-center py-10 text-secondary-400 text-sm">No commissions found</p>}
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages} · {pagination.total} records</span>
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
