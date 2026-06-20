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
  default:                            { span: '', bg: 'bg-secondary-100', icon: 'text-secondary-500', text: 'text-secondary-800' },
};

const USP = [
  { Icon: Truck,       text: 'Free Delivery',    sub: 'Orders above ₹999' },
  { Icon: ShieldCheck, text: 'Genuine Products', sub: '100% Authentic' },
  { Icon: FileText,    text: 'GST Invoice',      sub: 'For all orders' },
  { Icon: RotateCcw,   text: 'Easy Returns',     sub: '7-day policy' },
];

function SectionHead({ badge, title, sub, to, linkText }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {badge && (
          <span className="inline-flex items-center gap-1.5 bg-primary-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-[0.14em] mb-2.5">
            {badge}
          </span>
        )}
        <h2 className="text-[22px] font-black text-secondary-900 tracking-tight leading-none">{title}</h2>
        {sub && <p className="text-xs text-secondary-400 mt-1.5 font-medium">{sub}</p>}
      </div>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors mt-1 shrink-0 group">
          {linkText || 'View All'}
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

function HeroSection({ banners }) {
  const banner = banners?.[0];
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{
      minHeight: 270,
      background: 'linear-gradient(130deg, #130d05 0%, #281706 35%, #1b1f2e 100%)',
    }}>
      {banner?.image && (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover opacity-15" />
      )}

      {/* subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* depth + fade */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      {/* orange glow */}
      <div className="absolute -top-24 right-0 w-[500px] h-[500px] rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(249,115,22,0.22) 0%, transparent 65%)',
      }} />

      {/* left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
        style={{ background: 'linear-gradient(180deg, #fb923c 0%, #f97316 50%, #ea580c 100%)' }} />

      <div className="relative flex items-center h-full px-8 md:px-14 py-14 gap-8">
        <div className="flex-1 max-w-xl">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.14em] mb-5"
            style={{ background: 'rgba(249,115,22,0.18)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.35)' }}>
            <Sprout size={10} /> {banner?.subtitle || 'Premium Industrial Collection'}
          </span>

          <h1 className="text-[2.6rem] md:text-5xl font-black text-white leading-[1.08] tracking-tight">
            {banner?.title || <>Professional<br />Tools &amp; Machinery</>}
          </h1>

          <p className="mt-4 text-sm leading-relaxed max-w-sm" style={{ color: '#7c8fa8' }}>
            Trusted by engineers, contractors &amp; workshops across India. Genuine brands, fast delivery.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <Link to={banner?.link || '/products'} className="btn-primary px-7 py-3 text-sm font-bold"
              style={{ boxShadow: '0 8px 24px rgba(249,115,22,0.38)' }}>
              Shop Now <ArrowRight size={15} />
            </Link>
            <Link to="/categories" className="px-7 py-3 text-sm font-semibold rounded-lg transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.14)', color: '#94a3b8', background: 'rgba(255,255,255,0.05)' }}>
              Browse Categories
            </Link>
          </div>
        </div>

        {/* Stats — desktop */}
        <div className="hidden lg:flex flex-col gap-3 mr-4 shrink-0">
          {[['50K+', 'Engineers', '👷'], ['500+', 'Products', '🔧'], ['Pan India', 'Delivery', '🚚']].map(([n, l, e]) => (
            <div key={l} className="rounded-xl px-5 py-3.5 text-center min-w-[115px]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)' }}>
              <div className="text-[10px] mb-0.5" style={{ color: '#64748b' }}>{e}</div>
              <div className="font-black text-xl leading-none" style={{ color: '#fb923c' }}>{n}</div>
              <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>{l}</div>
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

  const { data: bannersData }    = useFetch(['banners'],       () => api.get('/catalog/banners').then((r) => r.data));
  const { data: categoriesData } = useFetch(['categories'],    () => api.get('/catalog/categories').then((r) => r.data));
  const { data: productsData }   = useFetch(['home-products'], () => api.get('/catalog/products', { params: { limit: 8 } }).then((r) => r.data));

  const categories   = categoriesData?.categories || [];
  const topCats      = categories.filter((c) => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const homeProducts = productsData?.products || [];

  return (
    <div className="flex w-full">

      {/* Sticky left sidebar — lg+ */}
      {categories.length > 0 && (
        <aside className="hidden lg:block w-48 shrink-0 self-start sticky z-40" style={{ top: '110px' }}>
          <CategorySidebar categories={categories} sticky />
        </aside>
      )}

      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 space-y-6">

        {/* 1. Hero */}
        <HeroSection banners={bannersData?.banners} />

        {/* 2. Trust bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {USP.map(({ Icon, text, sub }) => (
            <div key={text} className="flex items-center gap-3 bg-white border border-white/80 rounded-xl px-4 py-3.5 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <Icon size={17} className="text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-secondary-800 leading-tight">{text}</p>
                <p className="text-[10px] text-secondary-400 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Popular Products — FIRST */}
        {homeProducts.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-white/80 p-5 md:p-6">
            <SectionHead
              badge="Top Picks"
              title="Popular Products"
              sub="Bestsellers from our catalog"
              to="/products"
            />
            {/* mobile: horizontal snap-scroll */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 md:hidden snap-x snap-mandatory">
              {homeProducts.map((p) => (
                <div key={p._id} className="w-[172px] shrink-0 snap-start">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            {/* desktop: grid */}
            <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4">
              {homeProducts.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
            <div className="mt-5 text-center">
              <Link to="/products"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700 border border-primary-200 hover:border-primary-400 bg-primary-50 hover:bg-primary-100 px-6 py-2.5 rounded-lg transition-all">
                View All Products <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        )}

        {/* 4. Shop by Category */}
        {topCats.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-white/80 p-5 md:p-6">
            <SectionHead
              badge="Collections"
              title="Shop by Category"
              sub="Find exactly what your project needs"
              to="/categories"
              linkText="All Categories"
            />

            {/* mobile: 3-col */}
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

            {/* desktop: bento */}
            <div className="hidden md:grid grid-cols-4 gap-3" style={{ gridAutoRows: '160px' }}>
              {topCats.map((cat) => {
                const Icon    = CAT_ICONS[cat.slug] || CAT_ICONS.default;
                const cfg     = BENTO[cat.slug] || BENTO.default;
                const isLarge = cfg.span.includes('row-span-2');
                const isWide  = cfg.span.includes('col-span-2') && !isLarge;

                return (
                  <Link key={cat._id} to={`/category/${cat.slug}`}
                    className={`${cfg.span} relative rounded-xl overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 ${cfg.bg}`}>

                    {isLarge && (
                      <>
                        <Icon size={130} className={`absolute -top-4 -right-6 opacity-[0.065] ${cfg.icon}`} />
                        {cat.image && (
                          <img src={normalizeImageUrl(cat.image)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" onError={(e) => e.currentTarget.remove()} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <div className="w-9 h-9 rounded-lg bg-black/15 flex items-center justify-center mb-2.5">
                            <Icon size={20} className={cfg.icon} />
                          </div>
                          <p className={`text-xl font-black leading-tight ${cfg.text}`}>{cat.name}</p>
                          <p className={`text-[11px] mt-1.5 font-semibold flex items-center gap-0.5 opacity-55 ${cfg.text}`}>
                            Explore <ChevronRight size={11} />
                          </p>
                        </div>
                      </>
                    )}

                    {isWide && (
                      <div className="h-full flex items-center justify-between px-7">
                        <div>
                          <p className={`text-lg font-black ${cfg.text}`}>{cat.name}</p>
                          <p className={`text-[11px] mt-1.5 font-semibold flex items-center gap-0.5 opacity-55 ${cfg.text}`}>
                            Browse products <ChevronRight size={11} />
                          </p>
                        </div>
                        {cat.image
                          ? <img src={normalizeImageUrl(cat.image)} alt="" className="h-20 w-20 object-contain opacity-90" onError={(e) => e.currentTarget.remove()} />
                          : <Icon size={50} className={`${cfg.icon} opacity-75 group-hover:scale-110 group-hover:opacity-90 transition-all duration-200`} />}
                      </div>
                    )}

                    {!isLarge && !isWide && (
                      <div className="h-full flex flex-col items-center justify-center gap-2.5 p-4">
                        {cat.image
                          ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-11 h-11 object-contain" onError={(e) => e.currentTarget.remove()} />
                          : <Icon size={32} className={`${cfg.icon} group-hover:scale-110 transition-transform duration-200`} />}
                        <p className={`text-[11px] font-bold text-center leading-snug ${cfg.text}`}>{cat.name}</p>
                      </div>
                    )}
                  </Link>
                );
              })}

              {/* View All */}
              <Link to="/categories"
                className="relative rounded-xl group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 bg-secondary-50 border-2 border-dashed border-secondary-200 hover:border-primary-300 flex flex-col items-center justify-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-primary-600 group-hover:bg-primary-700 flex items-center justify-center shadow"
                  style={{ boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
                  <ChevronRight size={18} className="text-white" />
                </div>
                <p className="text-[11px] font-bold text-secondary-500 group-hover:text-primary-600 transition-colors">View All</p>
              </Link>
            </div>
          </section>
        )}

        {/* 5. CTA */}
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{ background: 'linear-gradient(130deg, #130d05 0%, #281706 40%, #1b1f2e 100%)' }}>
          <div className="absolute -top-20 right-12 w-72 h-72 rounded-full pointer-events-none" style={{
            background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)',
          }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }} />
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
