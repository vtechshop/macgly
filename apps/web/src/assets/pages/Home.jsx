import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, Shield, Truck, Headphones, RotateCcw, ChevronRight, Zap } from 'lucide-react';
import { useDispatch } from 'react-redux';
import api from '../../utils/api';
import ProductGrid from '../components/product/ProductGrid';
import CategorySidebar from '../components/common/CategorySidebar';
import { setCart } from '../../store/slices/cartSlice';
import { useFetch } from '../../hooks';
import { normalizeImageUrl } from '../../utils/format';
import { setMeta } from '../../utils/seo';
import toast from 'react-hot-toast';

const TRUST_BADGES = [
  { icon: Shield,     title: '100% Genuine',    desc: 'Authenticated products only', bg: 'bg-blue-50',    fg: 'text-blue-600' },
  { icon: Truck,      title: 'Fast Delivery',    desc: 'Pan India shipping',          bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  { icon: Headphones, title: 'Expert Support',   desc: 'Technical assistance',        bg: 'bg-violet-50',  fg: 'text-violet-600' },
  { icon: RotateCcw,  title: 'Easy Returns',     desc: '7-day return policy',         bg: 'bg-orange-50',  fg: 'text-orange-600' },
];

const STATS = [
  { value: '50,000+', label: 'Happy Customers' },
  { value: '500+',    label: 'Products' },
  { value: '100+',    label: 'Trusted Vendors' },
  { value: '7-Day',   label: 'Easy Returns' },
];

const PROMO_BANNERS = [
  { label: 'POWER TOOLS',  sub: 'Up to 40% Off',    desc: 'Top brands at best prices',      color: 'from-orange-700 to-orange-500', to: '/products?category=power-tools' },
  { label: 'SPARE PARTS',  sub: 'OEM Quality',       desc: 'Genuine replacement parts',      color: 'from-slate-800 to-slate-600',   to: '/products?category=spare-parts' },
  { label: 'NEW ARRIVALS', sub: 'Latest Machines',   desc: 'Fresh stock added weekly',       color: 'from-blue-800 to-blue-600',     to: '/products?featured=true' },
];

function HeroSection({ banners }) {
  const banner = banners?.[0];
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: 440 }}>
      {banner?.image ? (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-secondary-900 to-secondary-800" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />

      {/* Glow orbs */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative px-8 md:px-14 py-16 md:py-20 max-w-2xl">
        <span className="inline-flex items-center gap-1.5 bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
          <Zap size={11} fill="currentColor" /> {banner?.subtitle || 'Premium Collection'}
        </span>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
          {banner?.title || <>Professional<br />Tools &<br />Machinery</>}
        </h1>
        <p className="mt-4 text-slate-300 text-sm md:text-base leading-relaxed max-w-sm">
          Trusted by engineers, contractors & workshops across India
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link to={banner?.link || '/products'} className="btn-primary px-6 py-2.5 text-sm shadow-lg shadow-orange-600/30">
            Shop Now <ArrowRight size={16} />
          </Link>
          <Link to="/products?category=spare-parts" className="btn border border-white/25 text-white hover:bg-white/10 px-6 py-2.5 text-sm">
            Spare Parts
          </Link>
        </div>

        <div className="flex gap-8 mt-10 pt-7 border-t border-white/10">
          {[['50K+', 'Engineers'], ['500+', 'Products'], ['Pan India', 'Delivery']].map(([n, l]) => (
            <div key={l}>
              <div className="text-white font-black text-xl leading-none">{n}</div>
              <div className="text-slate-500 text-xs mt-1">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const dispatch = useDispatch();

  useEffect(() => {
    setMeta({
      title: 'Macgly — Professional Tools & Machinery in India',
      description: 'Buy genuine power tools, hand tools, machines, spare parts and safety equipment from trusted vendors. Pan India delivery. Trusted by 50,000+ engineers & workshops.',
      canonical: 'https://macgly.com/',
    });
  }, []);

  const { data: bannersData } = useFetch(['banners'], () => api.get('/catalog/banners').then((r) => r.data));
  const { data: featuredData, isLoading } = useFetch(['featured'], () => api.get('/catalog/featured').then((r) => r.data));
  const { data: categoriesData } = useFetch(['categories'], () => api.get('/catalog/categories').then((r) => r.data));

  async function handleAddToCart(product) {
    try {
      const { data } = await api.post('/cart/items', { productId: product._id, quantity: 1 });
      dispatch(setCart(data.cart));
      toast.success(`${product.title} added to cart`);
    } catch {
      toast.error('Could not add to cart');
    }
  }

  const categories = categoriesData?.categories || [];

  return (
    <div className="flex w-full">

      {/* Sticky left category nav — desktop only */}
      {categories.length > 0 && (
        <aside className="hidden lg:block w-48 shrink-0 self-start sticky border-r border-secondary-200" style={{ top: '200px' }}>
          <CategorySidebar categories={categories} sticky />
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-4 space-y-6">

        {/* Hero */}
        <HeroSection banners={bannersData?.banners} />

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-secondary-200 border border-secondary-200 rounded-xl bg-white overflow-hidden shadow-sm">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-5 px-4 text-center">
              <span className="text-2xl font-black text-primary-600">{value}</span>
              <span className="text-xs text-secondary-500 font-medium mt-1">{label}</span>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRUST_BADGES.map(({ icon: Icon, title, desc, bg, fg }) => (
            <div key={title} className="card flex items-center gap-3.5 px-4 py-4 hover:shadow-md">
              <div className={`${bg} ${fg} p-3 rounded-xl shrink-0`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-secondary-900">{title}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile categories accordion */}
        {categories.length > 0 && (
          <section className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Shop by Category</h2>
              <Link to="/products" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
                All <ChevronRight size={14} />
              </Link>
            </div>
            <CategorySidebar categories={categories} />
          </section>
        )}

        {/* Promo banners */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PROMO_BANNERS.map((b) => (
            <Link key={b.label} to={b.to}
              className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${b.color} p-6 text-white hover:opacity-95 hover:shadow-xl transition-all duration-200 group`}
              style={{ minHeight: 130 }}>
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest">{b.sub}</p>
              <p className="text-xl font-black mt-1 leading-tight">{b.label}</p>
              <p className="text-xs opacity-60 mt-1">{b.desc}</p>
              <ArrowRight size={16} className="absolute right-5 bottom-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
            </Link>
          ))}
        </div>

        {/* Featured Products */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-black text-secondary-900 flex items-center gap-2">
                🔥 Featured Products
              </h2>
              <p className="text-xs text-secondary-400 mt-0.5">Handpicked top sellers from trusted vendors</p>
            </div>
            <Link to="/products?featured=true" className="btn-primary text-xs py-2 px-4">
              View All <ChevronRight size={14} />
            </Link>
          </div>
          <ProductGrid products={featuredData?.products} loading={isLoading} onAddToCart={handleAddToCart} />
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
