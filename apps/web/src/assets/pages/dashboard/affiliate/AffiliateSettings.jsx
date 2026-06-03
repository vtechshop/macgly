import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, Clock, Wallet, Percent,
  MousePointerClick, ShoppingCart, TrendingUp, Calendar,
  Shield, CreditCard, Link2, FileText, BarChart2,
  BadgeCheck, AlertTriangle, Copy, Check,
  ChevronDown, ChevronUp, Volume2, Eye, Mail, Tag,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, useAction, invalidateCache } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

import { getSoundEnabled as getSoundPref, toggleSound as persistSound, playClick } from '../../../../utils/sounds';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, label, value, iconBg, iconColor, valColor = 'text-secondary-900' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div>
          <p className="text-xs text-secondary-400">{label}</p>
          <p className={`font-bold text-lg leading-tight mt-0.5 ${valColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, iconBg, iconColor, title, description, badge, actionLabel, to }) {
  const badgeCls = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error:   'bg-red-100 text-red-700',
  };
  return (
    <Link to={to} className="card p-4 flex items-center gap-3 hover:border-primary-300 transition-colors group">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{title}</p>
          {badge && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeCls[badge.type] || 'bg-secondary-100 text-secondary-600'}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-xs text-secondary-400 mt-0.5">{description}</p>
        {actionLabel && (
          <p className="text-xs text-primary-600 font-medium mt-1 group-hover:underline">{actionLabel}</p>
        )}
      </div>
      <ChevronDown size={14} className="text-secondary-300 -rotate-90 shrink-0" />
    </Link>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-primary-600' : 'bg-secondary-300'}`}
    >
      <span
        className="absolute w-3.5 h-3.5 bg-white rounded-full shadow transition-all duration-200"
        style={{ left: checked ? 'calc(100% - 18px)' : 2 }}
      />
    </button>
  );
}

function PreferenceItem({ icon: Icon, iconBg, iconColor, title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-secondary-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={15} className={iconColor} />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-secondary-400">{description}</p>
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, iconColor = 'text-secondary-500', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={15} className={iconColor} />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        {open
          ? <ChevronUp size={15} className="text-secondary-400" />
          : <ChevronDown size={15} className="text-secondary-400" />
        }
      </button>
      {open && <div className="px-4 pb-4 border-t border-secondary-100">{children}</div>}
    </div>
  );
}

// ─── Status / KYC badges ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
        <BadgeCheck size={12} /> Active
      </span>
    );
  }
  if (status === 'suspended' || status === 'rejected') {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full capitalize">
        <AlertTriangle size={12} /> {status}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
      <Clock size={12} /> Pending
    </span>
  );
}

function KYCBadge({ status }) {
  const cfg = {
    approved:      { cls: 'bg-green-100 text-green-700',    text: 'Approved' },
    pending:       { cls: 'bg-amber-100 text-amber-700',    text: 'Pending' },
    rejected:      { cls: 'bg-red-100 text-red-700',        text: 'Rejected' },
    not_submitted: { cls: 'bg-secondary-100 text-secondary-600', text: 'Not Submitted' },
  }[status] || { cls: 'bg-secondary-100 text-secondary-600', text: status };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.text}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateSettings() {
  const [rev,          setRev]          = useState(0);
  const [codeCopied,   setCodeCopied]   = useState(false);
  const [linkCopied,   setLinkCopied]   = useState(false);

  // Preference state — optimistic, synced from backend on load
  const [soundEnabled,       setSoundEnabled]       = useState(getSoundPref());
  const [showEarnings,       setShowEarnings]       = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyReports,      setWeeklyReports]      = useState(true);
  const [monthlyReports,     setMonthlyReports]     = useState(true);
  const [promotionalEmails,  setPromotionalEmails]  = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: affiliateData, isLoading: profileLoading } = useFetch(
    ['affiliate-settings', rev],
    () => api.get('/affiliates/me').then((r) => r.data)
  );

  const { data: prefs } = useFetch(
    ['affiliate-preferences', rev],
    () => api.get('/affiliates/preferences').then((r) => r.data)
  );

  // Sync preference toggles from backend
  useEffect(() => {
    if (!prefs) return;
    const s = prefs.soundEnabled ?? true;
    setSoundEnabled(s);
    persistSound(s);
    setShowEarnings(prefs.showEarnings ?? true);
    setEmailNotifications(prefs.emailNotifications ?? true);
    setWeeklyReports(prefs.weeklyReports ?? true);
    setMonthlyReports(prefs.monthlyReports ?? true);
    setPromotionalEmails(prefs.promotionalEmails ?? false);
  }, [prefs]);

  // ── Preference mutation ───────────────────────────────────────────────────

  const { mutate: savePref } = useAction(
    (fields) => api.put('/affiliates/preferences', fields).then((r) => r.data),
    {
      onSuccess: () => invalidateCache('affiliate-preferences'),
      onError:   () => toast.error('Could not save preference'),
    }
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  function copyCode() {
    const code = affiliateData?.code;
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCodeCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function copyLink() {
    const code = affiliateData?.code;
    if (!code) return;
    navigator.clipboard.writeText(`${window.location.origin}?ref=${code}`).catch(() => {});
    setLinkCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function handleSoundToggle(val) {
    setSoundEnabled(val);
    persistSound(val);
    if (val) playClick();
    savePref({ soundEnabled: val });
  }

  function makePrefHandler(setter, field) {
    return (val) => { setter(val); savePref({ [field]: val }); };
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const d              = affiliateData || {};
  const kycStatus      = d.kyc?.status || 'not_submitted';
  const totalClicks    = d.totalClicks    || 0;
  const totalConv      = d.totalConversions || 0;
  const convRate       = totalClicks > 0 ? (totalConv / totalClicks * 100).toFixed(2) : '0.00';
  const memberSince    = d.createdAt
    ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const kycBadge = { approved: { type: 'success', text: 'Verified' }, pending: { type: 'warning', text: 'Pending' }, rejected: { type: 'error', text: 'Rejected' } }[kycStatus];
  const earning  = (val) => showEarnings ? formatCurrency(val || 0) : '₹•••••';

  if (profileLoading && !affiliateData) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-5">

      {/* 1 — Header card */}
      <div className="rounded-xl bg-gray-900 text-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-xl font-bold">Account Settings</h1>
            <p className="text-sm text-white/60 mt-0.5">Manage your affiliate account and preferences</p>
          </div>
          <StatusBadge status={d.status || 'pending'} />
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-xs text-white/50 mb-1">Your Affiliate Code</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-2xl font-bold font-mono tracking-widest">{d.code || '—'}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                {codeCopied ? <Check size={12} /> : <Copy size={12} />} Copy Code
              </button>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-400 transition-colors"
              >
                {linkCopied ? <Check size={12} /> : <Link2 size={12} />} Copy Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2 — Earnings stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard icon={DollarSign} label="Total Earnings"  value={earning(d.totalEarnings)}   iconBg="bg-green-100"  iconColor="text-green-600"  valColor="text-green-700" />
        <StatsCard icon={Clock}      label="Pending"          value={earning(d.pendingEarnings)} iconBg="bg-amber-100"  iconColor="text-amber-500"  valColor="text-amber-600" />
        <StatsCard icon={Wallet}     label="Paid Out"         value={earning(d.paidEarnings)}    iconBg="bg-blue-100"   iconColor="text-blue-600"   valColor="text-blue-700" />
        <StatsCard icon={Percent}    label="Commission Rate"  value={`${d.commissionPercentage ?? 5}%`} iconBg="bg-purple-100" iconColor="text-purple-600" valColor="text-purple-700" />
      </div>

      {/* 3 — Performance overview */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={15} className="text-secondary-400" />
          <p className="text-sm font-semibold">Performance Overview</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <MousePointerClick size={20} className="text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalClicks}</p>
            <p className="text-xs text-secondary-400">Total Clicks</p>
          </div>
          <div>
            <ShoppingCart size={20} className="text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalConv}</p>
            <p className="text-xs text-secondary-400">Conversions</p>
          </div>
          <div>
            <TrendingUp size={20} className="text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{convRate}%</p>
            <p className="text-xs text-secondary-400">Conv. Rate</p>
          </div>
          <div>
            <Calendar size={20} className="text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{memberSince}</p>
            <p className="text-xs text-secondary-400">Member Since</p>
          </div>
        </div>
      </div>

      {/* 4 — Quick actions */}
      <div>
        <p className="text-sm font-semibold mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickActionCard
            icon={Shield} iconBg="bg-blue-100" iconColor="text-blue-600"
            title="KYC & Bank Details" description="Complete verification and add bank account for payouts"
            badge={kycBadge} actionLabel="Manage KYC"
            to="/dashboard/affiliate/kyc"
          />
          <QuickActionCard
            icon={CreditCard} iconBg="bg-green-100" iconColor="text-green-600"
            title="Commission History" description="View earnings, pending payouts, and transaction history"
            actionLabel="View Commissions"
            to="/dashboard/affiliate/commissions"
          />
          <QuickActionCard
            icon={Link2} iconBg="bg-purple-100" iconColor="text-purple-600"
            title="Manage Links" description="Create and manage your affiliate product links"
            actionLabel="View Links"
            to="/dashboard/affiliate/links"
          />
          <QuickActionCard
            icon={FileText} iconBg="bg-orange-100" iconColor="text-orange-500"
            title="Performance Reports" description="Detailed analytics and performance insights"
            actionLabel="View Reports"
            to="/dashboard/affiliate"
          />
        </div>
      </div>

      {/* 5 — Preferences */}
      <CollapsibleSection title="Preferences" icon={BarChart2}>
        <div className="pt-3">
          <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-1">Display</p>
          <PreferenceItem
            icon={Volume2} iconBg="bg-secondary-100" iconColor="text-secondary-500"
            title="Sound Notifications" description="Play sounds for alerts and actions"
            checked={soundEnabled} onChange={handleSoundToggle}
          />
          <PreferenceItem
            icon={Eye} iconBg="bg-secondary-100" iconColor="text-secondary-500"
            title="Show Earnings" description="Display earnings amounts on dashboard"
            checked={showEarnings} onChange={makePrefHandler(setShowEarnings, 'showEarnings')}
          />
          <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mt-4 mb-1">Communication</p>
          <PreferenceItem
            icon={Mail} iconBg="bg-blue-50" iconColor="text-blue-500"
            title="Email Notifications" description="Commission and payout updates via email"
            checked={emailNotifications} onChange={makePrefHandler(setEmailNotifications, 'emailNotifications')}
          />
          <PreferenceItem
            icon={BarChart2} iconBg="bg-purple-50" iconColor="text-purple-500"
            title="Weekly Reports" description="Receive weekly performance summary"
            checked={weeklyReports} onChange={makePrefHandler(setWeeklyReports, 'weeklyReports')}
          />
          <PreferenceItem
            icon={BarChart2} iconBg="bg-purple-50" iconColor="text-purple-500"
            title="Monthly Reports" description="Receive monthly earnings report"
            checked={monthlyReports} onChange={makePrefHandler(setMonthlyReports, 'monthlyReports')}
          />
          <PreferenceItem
            icon={Tag} iconBg="bg-secondary-100" iconColor="text-secondary-400"
            title="Promotional Emails" description="New campaigns and promotional offers"
            checked={promotionalEmails} onChange={makePrefHandler(setPromotionalEmails, 'promotionalEmails')}
          />
        </div>
      </CollapsibleSection>

      {/* 6 — Account details */}
      <CollapsibleSection title="Account Details" icon={Shield}>
        <div className="pt-3 grid grid-cols-2 gap-3">
          <div className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-400 mb-1">Affiliate Code</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold font-mono">{d.code || '—'}</span>
              {d.code && (
                <button onClick={copyCode} className="text-secondary-400 hover:text-secondary-600 transition-colors">
                  {codeCopied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>
          <div className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-400 mb-1.5">Account Status</p>
            <StatusBadge status={d.status || 'pending'} />
          </div>
          <div className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-400 mb-1">Commission Rate</p>
            <p className="text-sm font-bold">{d.commissionPercentage ?? 5}%</p>
          </div>
          <div className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-400 mb-1.5">KYC Status</p>
            <KYCBadge status={kycStatus} />
          </div>
        </div>

        {d.razorpay?.accountStatus && d.razorpay.accountStatus !== 'not_connected' && (
          <div className="mt-3 bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-400 mb-1">Razorpay Account</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold capitalize">{d.razorpay.accountStatus}</span>
              {d.razorpay.settlementSchedule && (
                <span className="text-xs text-secondary-400">{d.razorpay.settlementSchedule}</span>
              )}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* 7 — Help section */}
      <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} className="text-blue-200" />
          <p className="text-sm font-semibold">Need Help?</p>
        </div>
        <p className="text-xs text-blue-200 mb-4">Have questions about your affiliate account or commissions?</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/dashboard/affiliate/support"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            Contact Support
          </Link>
          <Link
            to="/page/faq"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-white hover:bg-blue-50 text-blue-700 transition-colors"
          >
            View FAQs
          </Link>
        </div>
      </div>

      {/* 8 — Pro Tips */}
      <div className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-purple-200" />
          <p className="text-sm font-semibold">Pro Tips for Affiliates</p>
        </div>
        <ul className="space-y-2">
          {[
            'Complete KYC verification to unlock higher commission rates',
            'Share product-specific links for better conversion tracking',
            'Monitor your dashboard regularly to identify top-performing products',
            'Commissions are processed weekly once they reach the minimum threshold',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-purple-100">
              <span className="mt-0.5 text-purple-300 shrink-0">✦</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
