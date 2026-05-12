import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Copy, Check, RefreshCw,
  MousePointerClick, ShoppingBag, TrendingUp, IndianRupee,
  Home, Search, Tag, Package, Lightbulb,
} from 'lucide-react';
import api from '../../../../utils/api';
import { setUser } from '../../../../store/slices/authSlice';
import { useFetch } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function dayLabel(dateStr) {
  // Parse as noon local time to avoid UTC-midnight day-shift
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function LineChart({ data }) {
  const W = 400, H = 130, PX = 20, PY = 14;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.clicks, d.conversions)));
  const x = (i) => PX + (i / (data.length - 1)) * (W - PX * 2);
  const y = (v) => PY + (1 - v / maxVal) * (H - PY * 2);

  const clickPts = data.map((d, i) => `${x(i)},${y(d.clicks)}`).join(' ');
  const convPts  = data.map((d, i) => `${x(i)},${y(d.conversions)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
        {/* Grid */}
        {[0, 0.33, 0.66, 1].map((t) => (
          <line key={t}
            x1={PX} y1={PY + t * (H - PY * 2)}
            x2={W - PX} y2={PY + t * (H - PY * 2)}
            stroke="#f1f5f9" strokeWidth="1"
          />
        ))}
        {/* Clicks area fill */}
        <polygon
          points={`${x(0)},${H - PY} ${clickPts} ${x(data.length - 1)},${H - PY}`}
          fill="rgba(234,88,12,0.08)"
        />
        {/* Lines */}
        <polyline fill="none" stroke="#ea580c" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" points={clickPts} />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" points={convPts} />
        {/* Dots */}
        {data.map((d, i) => (
          <circle key={`c${i}`} cx={x(i)} cy={y(d.clicks)} r="3.5" fill="#fff" stroke="#ea580c" strokeWidth="2" />
        ))}
        {data.map((d, i) => (
          <circle key={`s${i}`} cx={x(i)} cy={y(d.conversions)} r="3.5" fill="#fff" stroke="#22c55e" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between px-5 -mt-1">
        {data.map((d) => (
          <span key={d.date} className="text-[10px] text-secondary-400">{dayLabel(d.date)}</span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ pending, paid }) {
  const R = 36;
  const circ = 2 * Math.PI * R;
  const total = pending + paid;

  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" className="w-28 h-28">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        <text x="50" y="54" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontFamily="sans-serif">No data</text>
      </svg>
    );
  }

  const paidArc    = (paid / total) * circ;
  const pendingArc = (pending / total) * circ;

  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28">
      <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {paid > 0 && (
        <circle cx="50" cy="50" r={R} fill="none" stroke="#22c55e" strokeWidth="14"
          strokeDasharray={`${paidArc} ${circ}`}
          strokeDashoffset={0}
          transform="rotate(-90 50 50)"
        />
      )}
      {pending > 0 && (
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f59e0b" strokeWidth="14"
          strokeDasharray={`${pendingArc} ${circ}`}
          strokeDashoffset={-paidArc}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  );
}

export default function AffiliateDashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [rev, setRev] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: stats, isLoading } = useFetch(
    ['affiliate-stats', rev],
    () => api.get('/affiliates/stats').then((r) => r.data)
  );

  const referralCode = stats?.referralCode || user?.affiliateProfile?.referralCode || null;
  const trackBase = referralCode
    ? `${window.location.origin}/api/affiliates/track?ref=${referralCode}`
    : '';

  const linkTemplates = referralCode ? [
    { id: 'home',     label: 'Homepage',      icon: Home,    url: `${trackBase}&redirect=/` },
    { id: 'search',   label: 'All Products',  icon: Search,  url: `${trackBase}&redirect=/products` },
    { id: 'category', label: 'Category Page', icon: Tag,     url: `${trackBase}&redirect=/products?category=tools` },
    { id: 'product',  label: 'Product Page',  icon: Package, url: `${trackBase}&redirect=/products` },
  ] : [];

  function copy(id, text) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleGenerateCode() {
    setGenerating(true);
    try {
      const { data } = await api.post('/affiliates/generate-code');
      dispatch(setUser(data.user));
      setRev((r) => r + 1);
      toast.success('Referral code generated!');
    } catch {
      toast.error('Could not generate code');
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const weeklyData = stats?.weeklyData || [];

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Welcome Back, {user?.name?.split(' ')[0]}! 👋</h1>
            <p className="text-primary-200 text-sm mt-0.5">
              Commission rate: {stats?.commissionRate ?? user?.affiliateProfile?.commissionRate ?? 5}% per sale
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {referralCode ? (
              <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
                <span className="text-sm font-mono font-bold tracking-widest">{referralCode}</span>
                <button
                  onClick={() => copy('code', referralCode)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Copy code"
                >
                  {copiedId === 'code' ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="flex items-center gap-1.5 bg-white text-primary-700 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                Get My Code
              </button>
            )}
            <button
              onClick={() => setRev((r) => r + 1)}
              className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
              title="Refresh stats"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            id: 'clicks', label: 'Total Clicks', sub: 'Referral link visits',
            value: stats?.totalClicks ?? 0,
            icon: MousePointerClick, color: 'bg-blue-500',
          },
          {
            id: 'sales', label: 'Total Sales', sub: 'Orders from referrals',
            value: stats?.totalSales ?? 0,
            icon: ShoppingBag, color: 'bg-purple-500',
          },
          {
            id: 'cvr', label: 'Conversion Rate', sub: 'Clicks → orders',
            value: `${stats?.conversionRate ?? 0}%`,
            icon: TrendingUp, color: 'bg-primary-500',
          },
          {
            id: 'earn', label: 'Total Earnings', sub: 'From delivered orders',
            value: formatCurrency(stats?.totalEarnings ?? 0),
            icon: IndianRupee, color: 'bg-green-500',
          },
        ].map((s) => (
          <div key={s.id} className="card p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color} mb-3`}>
              <s.icon size={18} className="text-white" />
            </div>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
            <p className="text-xs text-secondary-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly performance line chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Weekly Performance</h2>
            <div className="flex items-center gap-4 text-xs text-secondary-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-primary-500 rounded" />
                Clicks
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-green-500 rounded" />
                Conversions
              </span>
            </div>
          </div>
          {weeklyData.length > 0 ? (
            <LineChart data={weeklyData} />
          ) : (
            <div className="h-32 flex items-center justify-center text-secondary-400 text-sm">
              No data yet
            </div>
          )}
        </div>

        {/* Earnings donut */}
        <div className="card p-5">
          <h2 className="font-bold mb-4">Earnings Breakdown</h2>
          <div className="flex justify-center mb-4">
            <DonutChart
              pending={stats?.pendingEarnings ?? 0}
              paid={stats?.totalEarnings ?? 0}
            />
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
                Pending
              </span>
              <span className="font-semibold">{formatCurrency(stats?.pendingEarnings ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                Paid Out
              </span>
              <span className="font-semibold">{formatCurrency(stats?.totalEarnings ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Affiliate link templates */}
      {referralCode ? (
        <div className="card p-5">
          <h2 className="font-bold mb-1">Affiliate Links</h2>
          <p className="text-xs text-secondary-500 mb-4">Share these links — every click is tracked automatically</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {linkTemplates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-secondary-50 rounded-lg p-3">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                  <t.icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-secondary-400 truncate">{t.url}</p>
                </div>
                <button
                  onClick={() => copy(t.id, t.url)}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded border transition-colors shrink-0 ${
                    copiedId === t.id
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-secondary-200 text-secondary-700 hover:border-primary-300'
                  }`}
                >
                  {copiedId === t.id ? <Check size={12} /> : <Copy size={12} />}
                  {copiedId === t.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center space-y-3">
          <p className="font-medium">Generate your referral code to get shareable links</p>
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="btn-primary inline-flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating…' : 'Generate My Code'}
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-primary-600" />
          <h2 className="font-bold">How to Maximize Your Earnings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Share on WhatsApp & Social Media',
              desc: 'Post your affiliate links in WhatsApp groups, Instagram stories, and Facebook communities related to tools and industrial equipment.',
            },
            {
              title: 'Target B2B Customers',
              desc: 'Reach workshops, factories, and contractors who buy in bulk. Bigger orders mean bigger commissions for you.',
            },
            {
              title: 'Create Product Reviews',
              desc: 'Record YouTube reviews or write blog posts. Add your tracking link in the description — content compounds over time.',
            },
            {
              title: 'Link to Specific Products',
              desc: 'Direct links to relevant products convert far better than homepage links. Use the product-page link template above.',
            },
            {
              title: 'Follow Up Within 30 Days',
              desc: 'Clicked visitors are tracked for 30 days via cookie — remind your audience to complete their purchase.',
            },
            {
              title: 'Grow Your Referral Network',
              desc: 'Share your registration link so new users sign up under you. Every order they place earns you commission automatically.',
            },
          ].map((tip, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold">{tip.title}</p>
                <p className="text-xs text-secondary-500 mt-0.5 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
