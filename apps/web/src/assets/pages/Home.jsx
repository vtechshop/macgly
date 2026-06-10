import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, ChevronRight, Sprout, Wrench, Hammer, Cpu, Settings, Package, Home as HomeIcon, Pipette, UtensilsCrossed, Trees } from 'lucide-react';
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
  default: Package,
};

// Bento card config: span + bg + colors
// Order matters for CSS auto-placement — matches seed script displayOrder
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

function HeroSection({ banners }) {
  const banner = banners?.[0];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary-900 via-secondary-800 to-slate-700" style={{ minHeight: 180 }}>
      {banner?.image && (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-secondary-900/95 via-secondary-900/70 to-transparent" />
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center h-full px-8 md:px-12 py-10">
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-1.5 bg-primary-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3">
            <Sprout size={10} /> {banner?.subtitle || 'Premium Collection'}
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
            {banner?.title || 'Professional Tools & Machinery'}
          </h1>
          <p className="mt-2.5 text-secondary-400 text-sm leading-relaxed">
            Trusted by engineers, contractors & workshops across India
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link to={banner?.link || '/products'} className="btn-primary px-5 py-2 text-sm shadow-lg shadow-orange-600/20">
              Shop Now <ArrowRight size={15} />
            </Link>
            <Link to="/category/spare-parts" className="btn border border-white/20 text-secondary-300 hover:bg-white/10 hover:text-white px-5 py-2 text-sm">
              Spare Parts
            </Link>
          </div>
        </div>

        <div className="hidden md:flex flex-col gap-3 ml-auto mr-4 shrink-0">
          {[['50K+', 'Engineers'], ['500+', 'Products'], ['Pan India', 'Delivery']].map(([n, l]) => (
            <div key={l} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl px-5 py-3 text-center min-w-[100px]">
              <div className="text-primary-400 font-black text-lg leading-none">{n}</div>
              <div className="text-secondary-500 text-xs mt-1">{l}</div>
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

  const { data: bannersData } = useFetch(['banners'], () => api.get('/catalog/banners').then((r) => r.data));
  const { data: categoriesData } = useFetch(['categories'], () => api.get('/catalog/categories').then((r) => r.data));

  const categories = categoriesData?.categories || [];
  const topCats = categories.filter((c) => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return (
    <div className="flex w-full">

      {/* Sticky left category nav — desktop only */}
      {categories.length > 0 && (
        <aside className="hidden lg:block w-48 shrink-0 self-start sticky z-40" style={{ top: '110px' }}>
          <CategorySidebar categories={categories} sticky />
        </aside>
      )}

      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-4 space-y-6">

        <HeroSection banners={bannersData?.banners} />

        {/* Shop by Category */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-secondary-900">Shop by Category</h2>
              <p className="text-xs text-secondary-400 mt-0.5">Browse our full range of tools & machinery</p>
            </div>
            <Link to="/categories" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
              All Categories <ChevronRight size={14} />
            </Link>
          </div>

          {/* Mobile: simple 3-col grid */}
          <div className="grid grid-cols-3 gap-2.5 md:hidden">
            {topCats.map((cat) => {
              const Icon = CAT_ICONS[cat.slug] || CAT_ICONS.default;
              const cfg = BENTO[cat.slug] || BENTO.default;
              return (
                <Link key={cat._id} to={`/category/${cat.slug}`}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 h-24 ${cfg.bg} hover:opacity-90 transition-opacity`}>
                  {cat.image
                    ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.remove()} />
                    : <Icon size={24} className={cfg.icon} />
                  }
                  <span className={`text-[10px] font-bold text-center leading-tight ${cfg.text}`}>{cat.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Desktop: bento grid */}
          <div className="hidden md:grid grid-cols-4 gap-3" style={{ gridAutoRows: '165px' }}>
            {topCats.map((cat) => {
              const Icon = CAT_ICONS[cat.slug] || CAT_ICONS.default;
              const cfg = BENTO[cat.slug] || BENTO.default;
              const isLarge = cfg.span.includes('row-span-2');
              const isWide  = cfg.span.includes('col-span-2') && !isLarge;

              return (
                <Link
                  key={cat._id}
                  to={`/category/${cat.slug}`}
                  className={`${cfg.span} relative rounded-2xl overflow-hidden group hover:scale-[1.02] hover:shadow-xl transition-all duration-200 ${cfg.bg}`}
                >
                  {isLarge && (
                    <>
                      <Icon size={130} className={`absolute -top-4 -right-6 opacity-[0.07] ${cfg.icon}`} />
                      {cat.image && (
                        <img src={normalizeImageUrl(cat.image)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" onError={(e) => e.currentTarget.remove()} />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <Icon size={34} className={`${cfg.icon} mb-3`} />
                        <p className={`text-2xl font-black leading-tight ${cfg.text}`}>{cat.name}</p>
                        <p className={`text-xs mt-1.5 font-semibold flex items-center gap-1 opacity-60 ${cfg.text}`}>
                          Explore collection <ChevronRight size={12} />
                        </p>
                      </div>
                    </>
                  )}

                  {isWide && (
                    <div className="h-full flex items-center justify-between px-7">
                      <div>
                        <p className={`text-xl font-black ${cfg.text}`}>{cat.name}</p>
                        <p className={`text-xs mt-1 font-semibold flex items-center gap-1 opacity-60 ${cfg.text}`}>
                          Browse all products <ChevronRight size={11} />
                        </p>
                      </div>
                      {cat.image
                        ? <img src={normalizeImageUrl(cat.image)} alt="" className="h-24 w-24 object-contain opacity-90" onError={(e) => e.currentTarget.remove()} />
                        : <Icon size={54} className={`${cfg.icon} opacity-80 group-hover:scale-110 transition-transform duration-200`} />
                      }
                    </div>
                  )}

                  {!isLarge && !isWide && (
                    <div className="h-full flex flex-col items-center justify-center gap-2.5 p-4">
                      {cat.image
                        ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-12 h-12 object-contain" onError={(e) => e.currentTarget.remove()} />
                        : <Icon size={36} className={`${cfg.icon} group-hover:scale-110 transition-transform duration-200`} />
                      }
                      <p className={`text-[11px] font-bold text-center leading-tight ${cfg.text}`}>{cat.name}</p>
                    </div>
                  )}
                </Link>
              );
            })}

            {/* View All tile — fills the last empty cell */}
            <Link to="/categories"
              className="relative rounded-2xl overflow-hidden group hover:scale-[1.02] hover:shadow-xl transition-all duration-200 bg-secondary-100 border-2 border-dashed border-secondary-300 hover:border-primary-400 flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                <ChevronRight size={18} className="text-white" />
              </div>
              <p className="text-xs font-bold text-secondary-600 group-hover:text-primary-700">View All</p>
            </Link>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="relative overflow-hidden bg-gradient-to-r from-secondary-900 via-secondary-800 to-secondary-900 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative">
            <p className="text-white font-black text-xl">Need bulk orders or custom parts?</p>
            <p className="text-secondary-400 text-sm mt-1">Get special pricing for B2B orders and workshop requirements</p>
          </div>
          <Link to="/info/contact" className="btn-primary shrink-0 px-6 shadow-lg shadow-orange-600/20">
            Contact Us <ArrowRight size={16} />
          </Link>
        </div>

      </div>
    </div>
  );
}
