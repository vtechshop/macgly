import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  ArrowRight, ChevronRight,
  Sprout, Wrench, Hammer, Cpu, Settings, Package,
  Home as HomeIcon, Pipette, UtensilsCrossed, Trees,
  Truck, ShieldCheck, FileText, RotateCcw,
} from 'lucide-react';
import api from '../../utils/api';
import CategorySidebar from '../components/common/CategorySidebar';
import ProductCard from '../components/product/ProductCard';
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
  default: Package,
};

const BENTO = {
  'agricultural-industry-farm-tools': { span: 'md:col-span-2 md:row-span-2', bg: 'bg-[#F4E8CC]',   icon: 'text-amber-700',  text: 'text-amber-900'  },
  'engineering-workshop-kits':        { span: '',                             bg: 'bg-slate-900',   icon: 'text-orange-400', text: 'text-white'      },
  'hardware-tools':                   { span: '',                             bg: 'bg-orange-50',   icon: 'text-orange-600', text: 'text-orange-900' },
  'electronics-instruments':          { span: '',                             bg: 'bg-indigo-950',  icon: 'text-indigo-300', text: 'text-white'      },
  'general-machineries':              { span: '',                             bg: 'bg-zinc-800',    icon: 'text-zinc-300',   text: 'text-white'      },
  'spare-parts':                      { span: 'md:col-span-2',               bg: 'bg-primary-600', icon: 'text-orange-100', text: 'text-white'      },
  'household-cleaning-equipment':     { span: '',                             bg: 'bg-cyan-50',     icon: 'text-cyan-700',   text: 'text-cyan-900'   },
  'plumbing-hardware-construction':   { span: '',                             bg: 'bg-blue-950',    icon: 'text-sky-300',    text: 'text-white'      },
  'hotel-food-processing':            { span: 'md:col-span-2',               bg: 'bg-rose-800',    icon: 'text-rose-200',   text: 'text-white'      },
  'wood-carvings':                    { span: '',                             bg: 'bg-amber-950',   icon: 'text-amber-300',  text: 'text-white'      },
  default:                            { span: '',                             bg: 'bg-secondary-100', icon: 'text-secondary-500', text: 'text-secondary-800' },
};

const USP = [
  { Icon: Truck,       text: 'Free Delivery',    sub: 'Orders above ₹999' },
  { Icon: ShieldCheck, text: 'Genuine Products', sub: '100% Authentic' },
  { Icon: FileText,    text: 'GST Invoice',      sub: 'For all orders' },
  { Icon: RotateCcw,   text: 'Easy Returns',     sub: '7-day return policy' },
];

function HeroSection({ banners }) {
  const banner = banners?.[0];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary-900 via-secondary-800 to-slate-800" style={{ minHeight: 200 }}>
      {banner?.image && (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title} className="absolute inset-0 w-full h-full object-cover opacity-20" />
      )}
      {/* layered gradients for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-secondary-900/98 via-secondary-900/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/60 via-transparent to-transparent" />

      {/* accent line + glow */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-primary-600 to-primary-400" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-secondary-700/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center h-full px-8 md:px-14 py-12 gap-8">
        {/* Text */}
        <div className="max-w-lg flex-1">
          <span className="inline-flex items-center gap-1.5 bg-primary-600/90 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.15em] mb-4">
            <Sprout size={10} /> {banner?.subtitle || 'Premium Industrial Collection'}
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[1.15] tracking-tight">
            {banner?.title || <>Professional<br />Tools &amp; Machinery</>}
          </h1>
          <p className="mt-3 text-secondary-400 text-sm leading-relaxed max-w-sm">
            Trusted by engineers, contractors &amp; workshops across India. Genuine brands, pan-India delivery.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to={banner?.link || '/products'} className="btn-primary px-6 py-2.5 text-sm shadow-lg shadow-orange-600/25 hover:shadow-orange-600/40 transition-shadow">
              Shop Now <ArrowRight size={15} />
            </Link>
            <Link to="/categories" className="btn border border-white/15 text-secondary-300 hover:bg-white/8 hover:text-white px-6 py-2.5 text-sm backdrop-blur-sm">
              Browse Categories
            </Link>
          </div>
        </div>

        {/* Stats — desktop */}
        <div className="hidden lg:grid grid-cols-3 gap-3 mr-4 shrink-0">
          {[['50K+', 'Engineers Served'], ['500+', 'Products Listed'], ['Pan India', 'Delivery']].map(([n, l]) => (
            <div key={l} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4 text-center">
              <div className="text-primary-400 font-black text-2xl leading-none">{n}</div>
              <div className="text-secondary-500 text-[11px] mt-1.5 leading-tight">{l}</div>
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
      description: 'Buy genuine tools, machines, spare parts and equipment from trusted vendors. Pan India delivery.',
      canonical: 'https://www.macgly.com/',
    });
  }, []);

  const { data: bannersData }    = useFetch(['banners'],       () => api.get('/catalog/banners').then((r) => r.data));
  const { data: categoriesData } = useFetch(['categories'],    () => api.get('/catalog/categories').then((r) => r.data));
  const { data: productsData }   = useFetch(['home-products'], () => api.get('/catalog/products', { params: { limit: 8 } }).then((r) => r.data));

  const categories   = categoriesData?.categories || [];
  const topCats      = categories.filter((c) => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const homeProducts = productsData?.products || [];

  return (
    <div className="flex w-full">

      {/* Sticky left category nav — lg+ only */}
      {categories.length > 0 && (
        <aside className="hidden lg:block w-48 shrink-0 self-start sticky z-40" style={{ top: '110px' }}>
          <CategorySidebar categories={categories} sticky />
        </aside>
      )}

      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-4 space-y-6">

        <HeroSection banners={bannersData?.banners} />

        {/* USP Trust Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {USP.map(({ Icon, text, sub }) => (
            <div key={text} className="flex items-center gap-3 bg-white border border-secondary-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <Icon size={17} className="text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-secondary-800 leading-tight">{text}</p>
                <p className="text-[10px] text-secondary-400 leading-tight mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Shop by Category */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-secondary-900">Shop by Category</h2>
              <p className="text-xs text-secondary-400 mt-0.5">Browse our full range of tools &amp; machinery</p>
            </div>
            <Link to="/categories" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
              All Categories <ChevronRight size={14} />
            </Link>
          </div>

          {/* Mobile: 3-col grid */}
          <div className="grid grid-cols-3 gap-2.5 md:hidden">
            {topCats.map((cat) => {
              const Icon = CAT_ICONS[cat.slug] || CAT_ICONS.default;
              const cfg  = BENTO[cat.slug] || BENTO.default;
              return (
                <Link key={cat._id} to={`/category/${cat.slug}`}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 h-24 ${cfg.bg} active:opacity-80 transition-opacity`}>
                  {cat.image
                    ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.remove()} />
                    : <Icon size={24} className={cfg.icon} />}
                  <span className={`text-[10px] font-bold text-center leading-tight ${cfg.text}`}>{cat.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Desktop: bento grid */}
          <div className="hidden md:grid grid-cols-4 gap-3" style={{ gridAutoRows: '165px' }}>
            {topCats.map((cat) => {
              const Icon    = CAT_ICONS[cat.slug] || CAT_ICONS.default;
              const cfg     = BENTO[cat.slug] || BENTO.default;
              const isLarge = cfg.span.includes('row-span-2');
              const isWide  = cfg.span.includes('col-span-2') && !isLarge;

              return (
                <Link key={cat._id} to={`/category/${cat.slug}`}
                  className={`${cfg.span} relative rounded-2xl overflow-hidden group hover:scale-[1.02] hover:shadow-xl transition-all duration-200 ${cfg.bg}`}>

                  {isLarge && (
                    <>
                      <Icon size={140} className={`absolute -top-6 -right-8 opacity-[0.06] ${cfg.icon}`} />
                      {cat.image && (
                        <img src={normalizeImageUrl(cat.image)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" onError={(e) => e.currentTarget.remove()} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="w-10 h-10 rounded-xl bg-black/15 flex items-center justify-center mb-3">
                          <Icon size={22} className={cfg.icon} />
                        </div>
                        <p className={`text-2xl font-black leading-tight ${cfg.text}`}>{cat.name}</p>
                        <p className={`text-xs mt-2 font-semibold flex items-center gap-1 opacity-55 ${cfg.text}`}>
                          Explore collection <ChevronRight size={12} />
                        </p>
                      </div>
                    </>
                  )}

                  {isWide && (
                    <div className="h-full flex items-center justify-between px-8">
                      <div>
                        <p className={`text-xl font-black ${cfg.text}`}>{cat.name}</p>
                        <p className={`text-xs mt-1.5 font-semibold flex items-center gap-1 opacity-55 ${cfg.text}`}>
                          Browse all products <ChevronRight size={11} />
                        </p>
                      </div>
                      {cat.image
                        ? <img src={normalizeImageUrl(cat.image)} alt="" className="h-24 w-24 object-contain opacity-90" onError={(e) => e.currentTarget.remove()} />
                        : <Icon size={56} className={`${cfg.icon} opacity-75 group-hover:scale-110 group-hover:opacity-90 transition-all duration-200`} />}
                    </div>
                  )}

                  {!isLarge && !isWide && (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
                      {cat.image
                        ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-12 h-12 object-contain" onError={(e) => e.currentTarget.remove()} />
                        : <Icon size={34} className={`${cfg.icon} group-hover:scale-110 transition-transform duration-200`} />}
                      <p className={`text-[11px] font-bold text-center leading-snug ${cfg.text}`}>{cat.name}</p>
                    </div>
                  )}
                </Link>
              );
            })}

            {/* View All — fills last empty cell */}
            <Link to="/categories"
              className="relative rounded-2xl overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 bg-secondary-50 border-2 border-dashed border-secondary-200 hover:border-primary-300 flex flex-col items-center justify-center gap-2.5">
              <div className="w-11 h-11 rounded-full bg-primary-600 group-hover:bg-primary-700 transition-colors flex items-center justify-center shadow-md shadow-orange-400/30">
                <ChevronRight size={20} className="text-white" />
              </div>
              <p className="text-xs font-bold text-secondary-500 group-hover:text-primary-600 transition-colors">View All</p>
            </Link>
          </div>
        </section>

        {/* Popular Products */}
        {homeProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-secondary-900">Popular Products</h2>
                <p className="text-xs text-secondary-400 mt-0.5">Top picks from our catalog</p>
              </div>
              <Link to="/products" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {homeProducts.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <div className="relative overflow-hidden bg-gradient-to-br from-secondary-900 via-secondary-800 to-slate-800 rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-secondary-700/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative text-center md:text-left">
            <p className="text-white font-black text-xl md:text-2xl">Need bulk orders or custom parts?</p>
            <p className="text-secondary-400 text-sm mt-2 max-w-md">
              Get special pricing for B2B orders, workshop kits, and custom specifications.
            </p>
          </div>
          <div className="relative flex gap-3 shrink-0">
            <Link to="/info/contact" className="btn-primary px-6 py-2.5 shadow-lg shadow-orange-600/20 hover:shadow-orange-600/35 transition-shadow">
              Contact Us <ArrowRight size={16} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
