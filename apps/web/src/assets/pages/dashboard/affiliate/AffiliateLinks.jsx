import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Copy, Check, RefreshCw, Home, Search, Tag, Package, Link2 } from 'lucide-react';
import api from '../../../../utils/api';
import { setUser } from '../../../../store/slices/authSlice';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function AffiliateLinks() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [rev, setRev] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: stats, isLoading } = useFetch(
    ['affiliate-stats-links', rev],
    () => api.get('/affiliates/stats').then((r) => r.data)
  );

  const referralCode = stats?.referralCode || user?.affiliateProfile?.referralCode || null;
  const origin = window.location.origin;
  const registerLink = referralCode ? `${origin}/register?ref=${referralCode}` : '';

  const linkTemplates = referralCode ? [
    { id: 'home',     label: 'Homepage',        icon: Home,    url: `${origin}/?aff=${referralCode}`,                          desc: 'Send visitors to the main page' },
    { id: 'products', label: 'All Products',     icon: Search,  url: `${origin}/products?aff=${referralCode}`,                  desc: 'Browse the full product catalog' },
    { id: 'tools',    label: 'Tools Category',   icon: Tag,     url: `${origin}/products?category=tools&aff=${referralCode}`,   desc: 'Link directly to the tools section' },
    { id: 'product',  label: 'Featured Product', icon: Package, url: `${origin}/products?aff=${referralCode}`,                  desc: 'Deep link to a specific product page' },
    { id: 'register', label: 'Registration Link',icon: Link2,   url: registerLink,                                              desc: 'New users who sign up via this link are tracked under you' },
  ] : [];

  function copy(id, text) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Link copied!');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Links</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Share these links to earn commission on every referred sale</p>
      </div>

      {/* Referral code banner */}
      <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-1">Your Referral Code</p>
          {referralCode ? (
            <p className="text-3xl font-black text-primary-600 tracking-widest">{referralCode}</p>
          ) : (
            <p className="text-secondary-500 text-sm">No code yet</p>
          )}
        </div>
        <div className="flex gap-2">
          {referralCode && (
            <button
              onClick={() => copy('code', referralCode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                copiedId === 'code' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-secondary-50 border-secondary-200 text-secondary-700 hover:border-primary-300'
              }`}
            >
              {copiedId === 'code' ? <Check size={14} /> : <Copy size={14} />}
              Copy Code
            </button>
          )}
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 text-sm font-medium text-secondary-600 hover:border-primary-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {referralCode ? 'Regenerate' : 'Generate Code'}
          </button>
        </div>
      </div>

      {/* Link templates */}
      {referralCode ? (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-100">
            <p className="font-bold">Tracked Affiliate Links</p>
            <p className="text-xs text-secondary-500 mt-0.5">Every click through these URLs is counted in your dashboard</p>
          </div>
          <div className="divide-y divide-secondary-100">
            {linkTemplates.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                  <t.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t.label}</p>
                  <p className="text-xs text-secondary-400 mt-0.5">{t.desc}</p>
                  <p className="text-xs text-secondary-300 truncate mt-0.5 font-mono">{t.url}</p>
                </div>
                <button
                  onClick={() => copy(t.id, t.url)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${
                    copiedId === t.id
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-secondary-200 text-secondary-700 hover:border-primary-300'
                  }`}
                >
                  {copiedId === t.id ? <Check size={12} /> : <Copy size={12} />}
                  {copiedId === t.id ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center space-y-3">
          <Link2 size={36} className="mx-auto text-secondary-300" />
          <p className="font-medium text-secondary-600">Generate your referral code first to get shareable links</p>
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

      {/* How links work */}
      <div className="card p-5">
        <h2 className="font-bold mb-3">How Tracking Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            { step: '1', title: 'Visitor clicks your link', desc: 'A click is recorded and a 30-day tracking cookie is set on their browser.' },
            { step: '2', title: 'They browse & buy', desc: 'The cookie keeps them attributed to you even if they close the tab and come back later.' },
            { step: '3', title: 'You earn commission', desc: `You earn ${stats?.commissionRate ?? 5}% of the order total, credited once the order is delivered.` },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{item.step}</div>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-secondary-500 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
