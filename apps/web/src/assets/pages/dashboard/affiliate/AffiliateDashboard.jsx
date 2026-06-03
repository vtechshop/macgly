import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, MousePointerClick, ShoppingCart, Percent, DollarSign,
  Copy, Check, ExternalLink, Calendar, Award, Link2, ArrowRight, RefreshCw,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Hardcoded mock weekly data (spec requirement) ────────────────────────────
const WEEKLY_DATA = [
  { name: 'Mon', clicks: 45, conversions: 3 },
  { name: 'Tue', clicks: 52, conversions: 4 },
  { name: 'Wed', clicks: 38, conversions: 2 },
  { name: 'Thu', clicks: 67, conversions: 5 },
  { name: 'Fri', clicks: 73, conversions: 6 },
  { name: 'Sat', clicks: 89, conversions: 8 },
  { name: 'Sun', clicks: 64, conversions: 5 },
];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export default function AffiliateDashboard() {
  const [rev,      setRev]      = useState(0);
  const [copiedId, setCopiedId] = useState(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data:      stats,
    isLoading: statsLoading,
    error:     statsError,
  } = useFetch(
    ['affiliate-stats', rev],
    () => api.get('/affiliates/dashboard/stats').then((r) => r.data)
  );

  const {
    data:      linksData,
    isLoading: linksLoading,
    error:     linksError,
  } = useFetch(
    ['affiliate-links', rev],
    () => api.get('/affiliates/links').then((r) => r.data)
  );

  // ── Error classification ─────────────────────────────────────────────────────

  const statsStatus = statsError?.response?.status;
  const linksStatus = linksError?.response?.status;
  const isSafeError = [404, 403].includes(statsStatus) || [404, 403].includes(linksStatus);

  // Non-safe error → crash page
  if ((statsError && !isSafeError) || (linksError && linksStatus && ![404, 403].includes(linksStatus))) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="max-w-sm text-center card p-8">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award size={24} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-secondary-500 mb-6">Could not load your dashboard. Please try again.</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full">
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Loading — don't block on safe errors
  if ((statsLoading && !statsError) || (linksLoading && !linksError)) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  // ── KYC state ────────────────────────────────────────────────────────────────

  const kycNotApproved = linksStatus === 403 || statsStatus === 403;
  const kycStatus      = kycNotApproved
    ? (linksError?.response?.data?.error?.kycStatus
       || statsError?.response?.data?.error?.kycStatus
       || 'pending')
    : (stats?.kycStatus || 'pending');
  const needsKYC = kycNotApproved || (kycStatus !== 'approved' && kycStatus !== 'verified');

  const code          = linksData?.code || stats?.code || null;
  const commissionPct = linksData?.commissionPercentage ?? stats?.commissionPercentage ?? 5;
  const affiliateLinks = linksData?.links || [];

  const earningsData = [
    { name: 'Pending',  value: stats?.pendingEarnings || 0, color: '#f59e0b' },
    { name: 'Paid Out', value: stats?.paidEarnings    || 0, color: '#10b981' },
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function copy(id, text) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function refresh() {
    invalidateCache('affiliate-stats');
    invalidateCache('affiliate-links');
    setRev((r) => r + 1);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* KYC Banner */}
      {needsKYC && (
        <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Award size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">KYC Verification Required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You can use all affiliate features.{' '}
                {kycStatus === 'rejected'
                  ? 'Your KYC was rejected. Please update your documents.'
                  : 'Complete KYC verification to withdraw your earnings.'}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/affiliate/kyc"
            className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {kycStatus === 'rejected' ? 'Update KYC' : 'Complete KYC'}
          </Link>
        </div>
      )}

      {/* Welcome header */}
      <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome Back, Affiliate! 👋</h1>
            <p className="text-primary-100 text-sm mt-1">Here's your performance overview and earnings summary</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <Link
              to="/dashboard/affiliate/product-links"
              className="flex items-center gap-2 bg-white text-primary-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors shadow-md"
            >
              <Link2 size={14} /> Get Product Links
            </Link>
          </div>
        </div>
      </div>

      {/* Affiliate code card */}
      <div className={`rounded-xl border-2 p-5 transition-colors ${
        kycNotApproved
          ? 'bg-gray-50 border-gray-200'
          : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${kycNotApproved ? 'bg-gray-300' : 'bg-purple-600'}`}>
              <Award size={18} className="text-white" />
            </div>
            <div>
              <p className={`text-xs font-medium mb-0.5 ${kycNotApproved ? 'text-gray-400' : 'text-purple-500'}`}>
                Your Affiliate Code
              </p>
              <p className={`text-2xl font-bold tracking-widest font-mono ${kycNotApproved ? 'text-gray-400' : 'text-purple-900'}`}>
                {kycNotApproved ? '— — — —' : (code || '—')}
              </p>
              {kycNotApproved && (
                <p className="text-xs text-amber-600 font-medium mt-0.5">
                  Complete KYC to unlock your code
                </p>
              )}
            </div>
          </div>

          {kycNotApproved ? (
            <Link
              to="/dashboard/affiliate/kyc"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-md shrink-0"
            >
              Complete KYC →
            </Link>
          ) : code ? (
            <button
              onClick={() => copy('code', code)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-md shrink-0"
            >
              {copiedId === 'code' ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Code</>}
            </button>
          ) : null}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            id: 'clicks', icon: MousePointerClick,
            label: 'Total Clicks', sub: 'All time link clicks',
            value: stats?.totalClicks ?? 0,
            trend: '+12.5%', up: true,
            iconBg: 'bg-blue-100', iconColor: 'text-blue-600', valColor: 'text-gray-900',
          },
          {
            id: 'sales', icon: ShoppingCart,
            label: 'Total Sales', sub: 'Successful conversions',
            value: stats?.totalConversions ?? 0,
            trend: '-3.2%', up: false,
            iconBg: 'bg-green-100', iconColor: 'text-green-600', valColor: 'text-green-600',
          },
          {
            id: 'cvr', icon: Percent,
            label: 'Conversion Rate', sub: 'Clicks to sales ratio',
            value: `${stats?.conversionRate ?? 0}%`,
            trend: null,
            iconBg: 'bg-purple-100', iconColor: 'text-purple-600', valColor: 'text-purple-600',
          },
          {
            id: 'earn', icon: DollarSign,
            label: 'Total Earnings', sub: 'Commission earned',
            value: formatCurrency(stats?.totalEarnings ?? 0),
            trend: '+18.7%', up: true,
            iconBg: 'bg-amber-100', iconColor: 'text-amber-600', valColor: 'text-amber-600',
          },
        ].map((s) => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-secondary-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                <s.icon size={20} className={s.iconColor} />
              </div>
              {s.trend && (
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${s.up ? 'text-green-600' : 'text-red-500'}`}>
                  {s.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {s.trend}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-secondary-500 mt-1">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.valColor}`}>{s.value}</p>
            <p className="text-xs text-secondary-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly performance */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold">Weekly Performance</h2>
              <p className="text-xs text-secondary-400 mt-0.5">Last 7 days activity</p>
            </div>
            <Calendar size={18} className="text-secondary-400" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={WEEKLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }}
              />
              <Line
                type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Earnings breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold">Earnings</h2>
            <DollarSign size={18} className="text-secondary-400" />
          </div>
          <p className="text-xs text-secondary-400 mb-4">Breakdown</p>
          <div className="flex justify-center mb-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={earningsData} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  paddingAngle={5} dataKey="value"
                >
                  {earningsData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={CHART_TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                Pending
              </span>
              <span className="font-bold">{formatCurrency(stats?.pendingEarnings ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-green-50 rounded-lg text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                Paid Out
              </span>
              <span className="font-bold">{formatCurrency(stats?.paidEarnings ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Affiliate links */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-5 space-y-4">
        <h2 className="text-xl font-bold">Your Affiliate Links</h2>

        {affiliateLinks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {affiliateLinks.map((link, i) => (
              <div
                key={link.type}
                className="group bg-secondary-50 rounded-xl p-4 border-2 border-secondary-100 hover:border-primary-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary-100 p-1.5 rounded-lg group-hover:bg-primary-200 transition-colors">
                      <Link2 size={14} className="text-primary-600" />
                    </div>
                    <p className="text-sm font-semibold capitalize">{link.type}</p>
                  </div>
                  <button
                    onClick={() => copy(`link-${i}`, link.url)}
                    className="text-secondary-400 hover:text-primary-600 transition-colors"
                  >
                    {copiedId === `link-${i}` ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-xs text-secondary-500 mb-2">{link.description}</p>
                <div className="bg-white rounded-md p-2 border border-secondary-200 mb-3">
                  <code className="text-xs text-secondary-600 break-all line-clamp-2">{link.url}</code>
                </div>
                <button
                  onClick={() => copy(`link-btn-${i}`, link.url)}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2"
                >
                  {copiedId === `link-btn-${i}`
                    ? <><Check size={13} /> Copied!</>
                    : <><Copy size={13} /> Copy Link</>
                  }
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-400 py-2">
            {needsKYC
              ? 'Complete KYC verification to unlock your affiliate links.'
              : 'No links generated yet.'}
          </p>
        )}

        <Link
          to="/dashboard/affiliate/product-links"
          className="inline-flex items-center gap-2 btn-primary text-sm"
        >
          View All Product Links <ArrowRight size={14} />
        </Link>
      </div>

      {/* How to maximize earnings */}
      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
            <ExternalLink size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 text-base mb-3">🚀 How to Maximize Your Earnings</h3>
            <ul className="space-y-2">
              {[
                'Copy your affiliate links and share them on your website, blog, or social media',
                'Generate product-specific links from the "All Product Links" page for better conversions',
                'Track your performance — optimize based on which links get the most clicks and sales',
                `Cookie tracking ensures you get credit for up to 30 days after a visitor clicks your link`,
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="text-primary-600 font-bold shrink-0">{i + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
