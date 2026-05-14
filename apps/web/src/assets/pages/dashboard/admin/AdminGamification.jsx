import { useState, useEffect } from 'react';
import { Zap, HelpCircle, Star, Plus, Trash2, Save } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const SLICE_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#f97316'];

// ─── Spin Tab ─────────────────────────────────────────────────────────────────
function SpinTab() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useFetch(['admin-spin-config'], () => api.get('/admin/gamification/spin').then((r) => r.data));

  useEffect(() => { if (data?.config) setConfig(data.config); }, [data]);

  function setField(key, value) { setConfig((c) => ({ ...c, [key]: value })); }
  function setSlice(i, key, value) {
    setConfig((c) => {
      const slices = [...(c.slices || [])];
      slices[i] = { ...slices[i], [key]: value };
      return { ...c, slices };
    });
  }
  function addSlice() {
    setConfig((c) => ({
      ...c,
      slices: [...(c.slices || []), { label: 'New Prize', type: 'no_win', value: 0, probability: 0.1, color: SLICE_COLORS[c.slices?.length % SLICE_COLORS.length] }],
    }));
  }
  function removeSlice(i) { setConfig((c) => ({ ...c, slices: c.slices.filter((_, idx) => idx !== i) })); }

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/gamification/spin', config);
      toast.success('Spin config saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  }

  if (isLoading || !config) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  const totalProb = (config.slices || []).reduce((s, sl) => s + Number(sl.probability || 0), 0);

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-4">
        <h2 className="font-bold">Spin Settings</h2>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="spinEnabled" checked={config.isEnabled} onChange={(e) => setField('isEnabled', e.target.checked)} className="rounded" />
          <label htmlFor="spinEnabled" className="text-sm font-medium">Enable Spin to Win</label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Daily spins per user</label>
            <input type="number" className="input w-full" min={1} value={config.dailySpinsPerUser || 1} onChange={(e) => setField('dailySpinsPerUser', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Spins on registration</label>
            <input type="number" className="input w-full" min={0} value={config.spinsOnRegister || 0} onChange={(e) => setField('spinsOnRegister', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Wheel Slices</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Total probability: <span className={totalProb > 1 ? 'text-red-500 font-bold' : 'text-green-600'}>{totalProb.toFixed(2)}</span> (should be ≤ 1.0)</p>
          </div>
          <button onClick={addSlice} className="btn flex items-center gap-1.5 text-sm"><Plus size={14} /> Add Slice</button>
        </div>
        {(config.slices || []).map((slice, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-secondary-100 rounded-xl">
            <input type="color" value={slice.color} onChange={(e) => setSlice(i, 'color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
            <input className="input flex-1" placeholder="Label" value={slice.label} onChange={(e) => setSlice(i, 'label', e.target.value)} />
            <select className="input w-36" value={slice.type} onChange={(e) => setSlice(i, 'type', e.target.value)}>
              <option value="points">Points</option>
              <option value="discount">Discount %</option>
              <option value="free_shipping">Free Shipping</option>
              <option value="no_win">No Win</option>
            </select>
            {['points', 'discount'].includes(slice.type) && (
              <input type="number" className="input w-20" placeholder="Value" min={0} value={slice.value} onChange={(e) => setSlice(i, 'value', Number(e.target.value))} />
            )}
            <input type="number" className="input w-20" placeholder="Prob" step={0.01} min={0} max={1} value={slice.probability} onChange={(e) => setSlice(i, 'probability', Number(e.target.value))} />
            <button onClick={() => removeSlice(i)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-500" /></button>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={15} /> {saving ? 'Saving…' : 'Save Spin Config'}</button>
    </div>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────
function QuizTab() {
  const [rev, setRev] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useFetch(['admin-quiz', rev], () => api.get('/admin/gamification/quiz').then((r) => r.data));
  const questions = data?.questions || [];

  const BLANK = { question: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }], category: '', difficulty: 'medium', pointsOnCorrect: 10 };

  function setOpt(i, key, value) {
    setForm((f) => {
      const options = f.options.map((o, idx) => {
        if (key === 'isCorrect') return { ...o, isCorrect: idx === i };
        if (idx === i) return { ...o, [key]: value };
        return o;
      });
      return { ...f, options };
    });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (form._id) await api.put(`/admin/gamification/quiz/${form._id}`, form);
      else await api.post('/admin/gamification/quiz', form);
      toast.success('Saved');
      setForm(null);
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete question?')) return;
    try { await api.delete(`/admin/gamification/quiz/${id}`); setRev((r) => r + 1); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Quiz Questions</h2>
        <button onClick={() => setForm({ ...BLANK })} className="btn-primary flex items-center gap-2"><Plus size={15} /> Add Question</button>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : questions.length === 0 ? (
        <div className="card p-12 text-center text-secondary-400"><p>No questions yet.</p></div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q._id} className="card p-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm">{q.question}</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {q.options.map((o, i) => <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${o.isCorrect ? 'bg-green-100 text-green-700 font-semibold' : 'bg-secondary-100 text-secondary-500'}`}>{o.text}</span>)}
                </div>
                <p className="text-xs text-secondary-400 mt-1">{q.difficulty} · {q.pointsOnCorrect} pts {q.category && `· ${q.category}`}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setForm({ ...q })} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-500">✏️</button>
                <button onClick={() => del(q._id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-bold text-lg mb-4">{form._id ? 'Edit Question' : 'Add Question'}</h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Question *</label>
                <textarea className="input w-full" rows={2} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Options (tick the correct answer)</label>
                {form.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input type="radio" name="correct" checked={o.isCorrect} onChange={() => setOpt(i, 'isCorrect', true)} />
                    <input className="input flex-1" placeholder={`Option ${i + 1}`} value={o.text} onChange={(e) => setOpt(i, 'text', e.target.value)} required />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input className="input w-full" placeholder="Tools, General…" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty</label>
                  <select className="input w-full" value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Points</label>
                  <input type="number" className="input w-full" min={0} value={form.pointsOnCorrect} onChange={(e) => setForm((f) => ({ ...f, pointsOnCorrect: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setForm(null)} className="btn flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loyalty Config Tab ────────────────────────────────────────────────────────
function LoyaltyTab() {
  const [cfg, setCfg] = useState({ loyalty_points_per_rupee: 0.1, loyalty_rupee_per_point: 0.5, loyalty_min_redeem: 100 });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useFetch(['admin-loyalty-config'], () => api.get('/admin/gamification/loyalty-config').then((r) => r.data));
  useEffect(() => { if (data?.config) setCfg((c) => ({ ...c, ...data.config })); }, [data]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/gamification/loyalty-config', cfg);
      toast.success('Loyalty config saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <form onSubmit={save} className="space-y-5 max-w-lg">
      <div className="card p-5 space-y-4">
        <h2 className="font-bold">Loyalty Points Configuration</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Points earned per ₹1 spent</label>
          <input type="number" step={0.01} className="input w-full" value={cfg.loyalty_points_per_rupee} onChange={(e) => setCfg((c) => ({ ...c, loyalty_points_per_rupee: Number(e.target.value) }))} />
          <p className="text-xs text-secondary-400 mt-1">e.g. 0.1 = 1 point per ₹10 spent</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">₹ value per point (redemption)</label>
          <input type="number" step={0.01} className="input w-full" value={cfg.loyalty_rupee_per_point} onChange={(e) => setCfg((c) => ({ ...c, loyalty_rupee_per_point: Number(e.target.value) }))} />
          <p className="text-xs text-secondary-400 mt-1">e.g. 0.5 = 1 point = ₹0.50</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Minimum points to redeem</label>
          <input type="number" className="input w-full" value={cfg.loyalty_min_redeem} onChange={(e) => setCfg((c) => ({ ...c, loyalty_min_redeem: Number(e.target.value) }))} />
        </div>
      </div>
      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2"><Save size={15} /> {saving ? 'Saving…' : 'Save Config'}</button>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminGamification() {
  const [tab, setTab] = useState('spin');

  const TABS = [
    { key: 'spin', label: 'Spin to Win', icon: Zap },
    { key: 'quiz', label: 'Quiz', icon: HelpCircle },
    { key: 'loyalty', label: 'Loyalty Config', icon: Star },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Gamification</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Manage spin-to-win, quiz, and loyalty points settings</p>
      </div>

      <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'spin' && <SpinTab />}
      {tab === 'quiz' && <QuizTab />}
      {tab === 'loyalty' && <LoyaltyTab />}
    </div>
  );
}
