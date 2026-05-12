import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Copy, Check, Search, Package } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function AffiliateProductLinks() {
  const { user } = useSelector((s) => s.auth);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const referralCode = user?.affiliateProfile?.referralCode || null;
  const origin = window.location.origin;

  const { data, isLoading } = useFetch(
    ['affiliate-products', query],
    () => api.get('/catalog/products', { params: { search: query || undefined, limit: 30 } }).then((r) => r.data)
  );

  const products = data?.products || [];

  function trackLink(slug) {
    return `${origin}/product/${slug}?aff=${referralCode}`;
  }

  function copy(id, text) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">All Product Links</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Generate affiliate links for any product in the catalog</p>
      </div>

      {!referralCode ? (
        <div className="card p-8 text-center">
          <Package size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="font-medium text-secondary-600">You need a referral code to generate product links.</p>
          <p className="text-sm text-secondary-400 mt-1">Go to <strong>My Links</strong> to generate your code first.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="input pl-9 w-full"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : products.length === 0 ? (
            <div className="card p-10 text-center text-secondary-400">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-secondary-100">
                {products.map((p) => {
                  const url = trackLink(p.slug);
                  return (
                    <div key={p._id} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-10 h-10 rounded bg-secondary-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.images?.[0] ? (
                          <img
                            src={normalizeImageUrl(p.images[0])}
                            alt={p.title}
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <Package size={16} className="text-secondary-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                        <p className="text-xs text-secondary-400 font-mono truncate mt-0.5">{url}</p>
                      </div>
                      <button
                        onClick={() => copy(p._id, url)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${
                          copiedId === p._id
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-secondary-200 text-secondary-700 hover:border-primary-300'
                        }`}
                      >
                        {copiedId === p._id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === p._id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
