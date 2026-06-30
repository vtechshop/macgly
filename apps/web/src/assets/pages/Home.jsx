import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  ArrowRight, ChevronRight,
  Sprout, Wrench, Hammer, Cpu, Settings, Package,
  Home as HomeIcon, Pipette, UtensilsCrossed, Trees,
} from 'lucide-react';
import api from '../../utils/api';
import CategorySidebar from '../components/common/CategorySidebar';
import { useFetch } from '../../hooks';
import { normalizeImageUrl } from '../../utils/format';
import { setMeta } from '../../utils/seo';

const CAT_ICONS = {
  'agricultural-industry-farm-tools': Sprout,
  'engineering-workshop-kits':        Wrench,
  'hardware-tools':                   Hammer,
  'electronics-instruments':          Cpu,
  'general-machineries':              Settings,
  'spare-parts':                      Package,
  'household-cleaning-equipment':     HomeIcon,
  'plumbing-hardware-construction':   Pipette,
  'hotel-food-processing':            UtensilsCrossed,
  'wood-carvings':                    Trees,
  default:                            Package,
};

function HeroSection({ banners }) {
  const banner = banners?.[0];
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{
      minHeight: 220,
      background: 'linear-gradient(135deg, #0c1520 0%, #162035 50%, #1a2a3e 100%)',
    }}>
      {banner?.image && (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover opacity-15" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <div className="absolute top-0 right-0 bottom-0 w-1/2 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 75% 45%, rgba(249,115,22,0.18) 0%, transparent 60%)',
      }} />
      <div className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: 'linear-gradient(180deg, #fdba74, #f97316, #c2410c)' }} />

      <div className="relative flex items-center h-full px-8 md:px-12 py-7 gap-6">
        <div className="flex-1 max-w-xl">
          <span className="inline-flex items-center gap-1.5 bg-primary-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.15em] mb-4">
            <Sprout size={9} /> {banner?.subtitle || 'Premium Collection'}
          </span>
          <h1 className="text-[2.4rem] md:text-[3rem] font-black text-white leading-[1.08] tracking-tight">
            {banner?.title || <>Professional<br />Tools &amp; Machinery</>}
          </h1>
          <p className="mt-3 text-sm leading-relaxed max-w-sm" style={{ color: '#8898b3' }}>
            Trusted by engineers, contractors &amp; workshops across India. Genuine brands, fast delivery.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link to={banner?.link || '/products'} className="btn-primary px-6 py-2.5 text-sm font-bold"
              style={{ boxShadow: '0 6px 20px rgba(249,115,22,0.38)' }}>
              Shop Now <ArrowRight size={14} />
            </Link>
            <Link to="/category/spare-parts"
              className="px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', background: 'rgba(255,255,255,0.05)' }}>
              Spare Parts
            </Link>
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-3 mr-2 shrink-0">
          {[['50K+', 'Engineers'], ['500+', 'Products'], ['Pan India', 'Delivery']].map(([n, l]) => (
            <div key={l} className="rounded-xl px-5 py-4 text-center min-w-[110px]"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)' }}>
              <div className="font-black text-xl leading-none" style={{ color: '#fb923c' }}>{n}</div>
              <div className="text-[11px] mt-1" style={{ color: '#64748b' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    setMeta({
      title: 'Macgly — Professional Tools & Machinery in India',
      description: 'Buy genuine tools, machines, spare parts and equipment. Pan India delivery.',
      canonical: 'https://macgly.com/',
    });
  }, []);

  const { data: bannersData }    = useFetch(['banners'],    () => api.get('/catalog/banners').then((r) => r.data));
  const { data: categoriesData } = useFetch(['categories'], () => api.get('/catalog/categories').then((r) => r.data));

  const categories = categoriesData?.categories || [];
  const topCats    = categories.filter((c) => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return (
    <div className="flex w-full">

      {categories.length > 0 && (
        <aside className="hidden lg:block w-48 shrink-0 self-start sticky z-40" style={{ top: '110px' }}>
          <CategorySidebar categories={categories} sticky />
        </aside>
      )}

      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 space-y-6">

        <HeroSection banners={bannersData?.banners} />

        {/* Shop by Category */}
        {topCats.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-secondary-900">Shop by Category</h2>
                <p className="text-sm text-secondary-400 mt-0.5">Select a category to explore products</p>
              </div>
              <Link to="/categories" className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                All Categories <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {topCats.map((cat) => {
                const Icon = CAT_ICONS[cat.slug] || CAT_ICONS.default;
                return (
                  <Link key={cat._id} to={`/category/${cat.slug}`}
                    className="flex flex-col items-center justify-center gap-2 p-3 h-36 bg-white border border-secondary-200 rounded-xl hover:border-primary-300 hover:shadow-md transition-all group">
                    {cat.image
                      ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-16 h-16 object-contain" onError={(e) => e.currentTarget.remove()} />
                      : <Icon size={40} className="text-secondary-300 group-hover:text-primary-500 transition-colors" />
                    }
                    <span className="text-xs font-semibold text-secondary-600 group-hover:text-secondary-900 text-center leading-tight transition-colors">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{ background: 'linear-gradient(130deg, #130d05 0%, #281706 40%, #1b1f2e 100%)' }}>
          <div className="absolute -top-20 right-12 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)' }} />
          <div className="relative text-center md:text-left">
            <p className="text-white font-black text-xl md:text-2xl tracking-tight">Need bulk orders or custom parts?</p>
            <p className="text-sm mt-2 max-w-md" style={{ color: '#64748b' }}>
              Special pricing for B2B orders, workshop kits &amp; custom specifications.
            </p>
          </div>
          <Link to="/info/contact" className="btn-primary px-7 py-3 shrink-0 font-bold"
            style={{ boxShadow: '0 8px 24px rgba(249,115,22,0.38)' }}>
            Contact Us <ArrowRight size={16} />
          </Link>
        </div>

      </div>
    </div>
  );
}
