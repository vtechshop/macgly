import { useState } from 'react';
import { Plus, Edit2, Trash2, Zap, ArrowLeft } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }

const EMPTY = { title: '', description: '', startTime: '', endTime: '', products: [] };

function FlashSaleForm({ initial = EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...initial, startTime: initial.startTime ? new Date(initial.startTime).toISOString().slice(0, 16) : '', endTime: initial.endTime ? new Date(initial.endTime).toISOString().slice(0, 16) : '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="card p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium mb-1">Title *</label><input className="input w-full" value={form.title} onChange={set('title')} required /></div>
        <div><label className="block text-sm font-medium mb-1">Description</label><input className="input w-full" value={form.description} onChange={set('description')} /></div>
        <div><label className="block text-sm font-medium mb-1">Start Time *</label><input className="input w-full" type="datetime-local" value={form.startTime} onChange={set('startTime')} required /></div>
        <div><label className="block text-sm font-medium mb-1">End Time *</label><input className="input w-full" type="datetime-local" value={form.endTime} onChange={set('endTime')} required /></div>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">{saving ? <Spinner size="sm" /> : null} Save Flash Sale</button>
        <button type="button" onClick={onCancel} className="btn">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminFlashSales() {
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(['admin-flash-sales', rev], () => api.get('/admin/flash-sales').then((r) => r.data));
  const sales = data?.flashSales || [];

  async function handleSave(form) {
    setSaving(true);
    try {
      if (selected) { await api.put(`/admin/flash-sales/${selected._id}`, form); toast.success('Updated'); }
      else { await api.post('/admin/flash-sales', form); toast.success('Created'); }
      setView('list'); setSelected(null); setRev((r) => r + 1);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Save failed'); } finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this flash sale?')) return;
    try { await api.delete(`/admin/flash-sales/${id}`); toast.success('Deleted'); setRev((r) => r + 1); } catch { toast.error('Failed'); }
  }

  if (view !== 'list') return (
    <div className="space-y-4">
      <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium"><ArrowLeft size={16} /> Back</button>
      <h1 className="text-2xl font-bold">{selected ? 'Edit Flash Sale' : 'New Flash Sale'}</h1>
      <FlashSaleForm initial={selected || EMPTY} onSave={handleSave} onCancel={() => { setView('list'); setSelected(null); }} saving={saving} />
    </div>
  );

  const now = new Date();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Flash Sales</h1><p className="text-secondary-500 text-sm mt-0.5">Time-limited deals</p></div>
        <button onClick={() => setView('new')} className="btn-primary flex items-center gap-2"><Plus size={15} /> New Flash Sale</button>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : sales.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400"><Zap size={40} className="mx-auto mb-3 opacity-30" /><p>No flash sales yet</p></div>
      ) : (
        <div className="grid gap-4">
          {sales.map((s) => {
            const active = s.isActive && new Date(s.startTime) <= now && new Date(s.endTime) >= now;
            const upcoming = new Date(s.startTime) > now;
            const ended = new Date(s.endTime) < now;
            return (
              <div key={s._id} className="card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{s.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : upcoming ? 'bg-blue-100 text-blue-700' : 'bg-secondary-100 text-secondary-500'}`}>
                      {active ? 'Live' : upcoming ? 'Upcoming' : 'Ended'}
                    </span>
                  </div>
                  <p className="text-xs text-secondary-400">{fmtDate(s.startTime)} → {fmtDate(s.endTime)} · {s.products?.length || 0} products</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelected(s); setView('edit'); }} className="p-1.5 hover:bg-secondary-100 rounded-lg"><Edit2 size={14} className="text-blue-600" /></button>
                  <button onClick={() => del(s._id)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><Trash2 size={14} className="text-red-500" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
