import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy, Check, RefreshCw, Home, Search, Tag, ShoppingBag, Link2, Shield,
  MousePointerClick, TrendingUp, DollarSign, Clock, ChevronDown, ChevronUp,
  Facebook, Twitter, Mail, Lightbulb, LayoutGrid, IndianRupee,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Static config ────────────────────────────────────────────────────────────

const LINK_CFG = {
  homepage: { icon: Home,        iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   label: 'Homepage' },
  search:   { icon: Search,      iconBg: 'bg-purple-100', iconColor: 'text-purple-600', label: 'Search' },
  category: { icon: Tag,         iconBg: 'bg-orange-100', iconColor: 'text-orange-500', label: 'Category' },
  product:  { icon: ShoppingBag, iconBg: 'bg-green-100',  iconColor: 'text-green-600',  label: 'Product' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, label, value, badge, iconBg, iconColor, valColor }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-secondary-400">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className={`font-bold text-lg leading-none ${valColor}`}>{value}</p>
            {badge && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{badge}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkCard({ link, copiedId, onCopy }) {
  const cfg = LINK_CFG[link.type] || { icon: Link2, iconBg: 'bg-secondary-100', iconColor: 'text-secondary-500', label: link.type };
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-secondary-200 hover:border-primary-300 transition-colors bg-white">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
        <Icon size={16} className={cfg.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold capitalize">{cfg.label}</p>
            <p className="text-xs text-secondary-400 mt-0.5">{link.description}</p>
          </div>
          <button
            onClick={() => onCopy(link.type, link.url)}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
              copiedId === link.type
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-secondary-200 text-secondary-700 hover:border-primary-300'
            }`}
          >
            {copiedId === link.type ? <Check size={12} /> : <Copy size={12} />}
            {copiedId === link.type ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div className="mt-2 p-2 bg-secondary-50 rounded-lg border border-secondary-100">
          <code className="text-xs text-secondary-500 break-all">{link.url}</code>
        </div>
      </div>
    </div>
  );
}

function SocialBtn({ color, label, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 ${color}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

// ─── KYC Gate ─────────────────────────────────────────────────────────────────

function KYCGate({ kycStatus }) {
  const isPending = kycStatus === 'pending';
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
        <Shield size={30} className="text-amber-400" />
      </div>
      <div>
        <p className="text-lg font-bold">KYC Verification Required</p>
        <p className="text-sm text-secondary-500 mt-1 max-w-sm">
          Please complete and submit your KYC verification to access affiliate links and start earning commissions.
        </p>
      </div>
      {isPending ? (
        <Link to="/dashboard/affiliate/kyc" className="btn-primary px-6">
          View KYC Status →
        </Link>
      ) : (
        <Link to="/dashboard/affiliate/kyc" className="btn-primary px-6">
          Complete KYC →
        </Link>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateLinks() {
  const [rev,             setRev]             = useState(0);
  const [copiedId,        setCopiedId]        = useState(null);
  const [showTips,        setShowTips]        = useState(false);
  const [showLinkBuilder, setShowLinkBuilder] = useState(false);
  const [customSlug,      setCustomSlug]      = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data:      linksData,
    isLoading: linksLoading,
    error:     linksError,
  } = useFetch(
    ['affiliate-links', rev],
    () => api.get('/affiliates/links').then((r) => r.data)
  );

  const {
    data:  stats,
    error: statsError,
  } = useFetch(
    ['affiliate-dashboard-stats', rev],
    () => api.get('/affiliates/dashboard/stats').then((r) => r.data)
  );

  // ── Derived state (must be before early returns — hooks can't follow returns) ─

  const code          = linksData?.code || null;
  const commissionPct = linksData?.commissionPercentage ?? 5;
  const links         = linksData?.links || [];
  const homepageUrl   = links[0]?.url || '';

  const generatedCustomLink = useMemo(() => {
    if (!customSlug.trim() || !code) return '';
    return `${window.location.origin}/products/${customSlug.trim()}?affId=${code}`;
  }, [customSlug, code]);

  // ── Error handling ────────────────────────────────────────────────────────

  const linksStatus = linksError?.response?.status;

  if (linksLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  // 403 → KYC gate
  if (linksStatus === 403) {
    const kycStatus = linksError?.response?.data?.error?.kycStatus || 'not_submitted';
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Links</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Generate and share your affiliate links</p>
        </div>
        <div className="card">
          <KYCGate kycStatus={kycStatus} />
        </div>
      </div>
    );
  }

  // 404 → no referral code yet (should rarely happen after auto-generate fix)
  if (linksStatus === 404) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Affiliate Links</h1>
        <div className="card p-12 text-center space-y-4">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
            <Link2 size={24} className="text-primary-500" />
          </div>
          <p className="font-medium text-secondary-700">No referral code found</p>
          <p className="text-sm text-secondary-400">Click refresh to generate your affiliate code.</p>
          <button onClick={() => { invalidateCache('affiliate-links'); setRev((r) => r + 1); }} className="btn-primary flex items-center gap-2 mx-auto">
            <RefreshCw size={14} /> Generate My Code
          </button>
        </div>
      </div>
    );
  }

  // Other errors
  if (linksError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Affiliate Links</h1>
        <div className="card p-12 text-center space-y-3">
          <p className="text-secondary-500 font-medium">Unable to load links</p>
          <button onClick={() => window.location.reload()} className="btn-secondary text-sm">Reload</button>
        </div>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function copy(id, text) {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function refresh() {
    invalidateCache('affiliate-links');
    invalidateCache('affiliate-dashboard-stats');
    setRev((r) => r + 1);
  }

  function openShare(url) {
    window.open(url, '_blank', 'width=600,height=400,noopener,noreferrer');
  }

  const shareText = `Check out Macgly — professional tools and machinery at great prices!`;
  const shareUrl  = encodeURIComponent(homepageUrl || window.location.origin);
  const shareMsg  = encodeURIComponent(`${shareText} ${homepageUrl}`);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Links</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Generate and share your affiliate links</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/dashboard/affiliate/product-links" className="btn-primary flex items-center gap-2 text-sm">
            <LayoutGrid size={14} /> All Product Links
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          icon={MousePointerClick} label="Total Clicks"
          value={stats?.totalClicks ?? linksData?.totalClicks ?? 0}
          iconBg="bg-blue-100" iconColor="text-blue-600" valColor="text-secondary-900"
        />
        <StatsCard
          icon={TrendingUp} label="Conversions"
          value={stats?.totalConversions ?? linksData?.totalConversions ?? 0}
          badge={stats?.conversionRate != null ? `${stats.conversionRate}%` : undefined}
          iconBg="bg-green-100" iconColor="text-green-600" valColor="text-green-600"
        />
        <StatsCard
          icon={IndianRupee} label="Total Earnings"
          value={formatCurrency(stats?.totalEarnings ?? linksData?.totalEarnings ?? 0)}
          iconBg="bg-purple-100" iconColor="text-purple-600" valColor="text-purple-600"
        />
        <StatsCard
          icon={Clock} label="Pending"
          value={formatCurrency(stats?.pendingEarnings ?? 0)}
          iconBg="bg-orange-100" iconColor="text-orange-500" valColor="text-orange-500"
        />
      </div>

      {/* Affiliate code card */}
      <div className="rounded-xl bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white p-5 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-primary-200 font-medium mb-1">Your Unique Affiliate Code</p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold tracking-widest font-mono">{code || '—'}</p>
              {code && (
                <button
                  onClick={() => copy('code', code)}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  {copiedId === 'code' ? <Check size={15} /> : <Copy size={15} />}
                </button>
              )}
            </div>
            <p className="text-xs text-primary-200 mt-1">
              Share this code with your audience to earn {commissionPct}% commission
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-200">Commission Rate</p>
            <p className="text-4xl font-black">{commissionPct}%</p>
          </div>
        </div>
      </div>

      {/* Custom link builder (accordion) */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setShowLinkBuilder((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center">
              <Link2 size={15} className="text-secondary-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Custom Link Builder</p>
              <p className="text-xs text-secondary-400">Create affiliate links for specific products</p>
            </div>
          </div>
          {showLinkBuilder ? <ChevronUp size={16} className="text-secondary-400" /> : <ChevronDown size={16} className="text-secondary-400" />}
        </button>

        {showLinkBuilder && (
          <div className="px-4 pb-4 space-y-3 border-t border-secondary-100 pt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Slug</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="e.g. premium-drill-machine"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                />
                <button
                  onClick={() => copy('custom', generatedCustomLink)}
                  disabled={!generatedCustomLink}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 ${
                    copiedId === 'custom'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-secondary-200 hover:border-primary-300'
                  }`}
                >
                  {copiedId === 'custom' ? <Check size={13} /> : <Copy size={13} />}
                  Copy
                </button>
              </div>
            </div>
            {generatedCustomLink && (
              <div className="p-2 bg-secondary-50 rounded-lg border border-secondary-100">
                <code className="text-xs text-secondary-500 break-all">{generatedCustomLink}</code>
              </div>
            )}
            <p className="text-xs text-secondary-400">
              Find product slugs on the{' '}
              <Link to="/dashboard/affiliate/product-links" className="text-primary-600 hover:underline">
                All Product Links
              </Link>{' '}
              page.
            </p>
          </div>
        )}
      </div>

      {/* Quick share links */}
      <div className="space-y-3">
        <h2 className="font-bold text-base">Quick Share Links</h2>
        <div className="space-y-3">
          {links.map((link) => (
            <LinkCard key={link.type} link={link} copiedId={copiedId} onCopy={copy} />
          ))}
        </div>
      </div>

      {/* Social sharing */}
      {homepageUrl && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-pink-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={14} className="text-pink-500" />
            </div>
            <p className="text-sm font-semibold">Share on Social Media</p>
            <p className="text-xs text-secondary-400">— Quickly share your homepage link</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SocialBtn
              color="bg-[#1877f2]" label="Facebook" icon={Facebook}
              onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`)}
            />
            <SocialBtn
              color="bg-[#1da1f2]" label="Twitter" icon={Twitter}
              onClick={() => openShare(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodeURIComponent(shareText)}`)}
            />
            <SocialBtn
              color="bg-[#25d366]" label="WhatsApp"
              icon={() => <span className="font-bold text-sm">W</span>}
              onClick={() => openShare(`https://wa.me/?text=${shareMsg}`)}
            />
            <SocialBtn
              color="bg-secondary-500" label="Email" icon={Mail}
              onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Check out Macgly')}&body=${shareMsg}`)}
            />
          </div>
        </div>
      )}

      {/* Tips accordion */}
      <div className="rounded-xl border border-amber-200 overflow-hidden">
        <button
          onClick={() => setShowTips((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" />
            <p className="text-sm font-semibold text-amber-800">Tips to Maximize Earnings</p>
            <p className="text-xs text-amber-600">Learn how to get more conversions</p>
          </div>
          {showTips
            ? <ChevronUp size={16} className="text-amber-500" />
            : <ChevronDown size={16} className="text-amber-500" />
          }
        </button>
        {showTips && (
          <div className="p-4 bg-white border-t border-amber-100 space-y-3">
            {[
              { title: 'Share on your website or blog', desc: "Embed affiliate links naturally within content that's relevant to tools and machinery buyers." },
              { title: 'Target the right audience',     desc: 'Reach workshops, factories, and contractors who buy in bulk — bigger orders mean bigger commissions.' },
              { title: 'Use product images & reviews',  desc: 'Share product-specific links alongside images and reviews for significantly higher click-through rates.' },
              { title: 'Create urgency',                desc: 'Mention limited stock or seasonal promotions to encourage faster purchase decisions.' },
              { title: '30-day cookie window',          desc: 'Visitors are attributed to you for 30 days after clicking your link — remind them to complete their purchase.' },
            ].map((tip, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold text-secondary-800">{tip.title}</p>
                  <p className="text-xs text-secondary-500 mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/dashboard/affiliate/product-links"
          className="card p-4 flex items-center justify-between hover:border-primary-300 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
              <LayoutGrid size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Browse All Products</p>
              <p className="text-xs text-secondary-400">Generate links for specific products</p>
            </div>
          </div>
          <ChevronDown size={16} className="text-secondary-300 -rotate-90 group-hover:text-primary-500 transition-colors" />
        </Link>
        <Link
          to="/dashboard/affiliate/commissions"
          className="card p-4 flex items-center justify-between hover:border-primary-300 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">View Commissions</p>
              <p className="text-xs text-secondary-400">Track your earnings and payouts</p>
            </div>
          </div>
          <ChevronDown size={16} className="text-secondary-300 -rotate-90 group-hover:text-primary-500 transition-colors" />
        </Link>
      </div>

    </div>
  );
}
