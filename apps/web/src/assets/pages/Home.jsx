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
  { icon: Shield,     title: '100% Genuine',    desc: 'Authenticated products only', bg: 'bg-primary-50',   fg: 'text-primary-600' },
  { icon: Truck,      title: 'Fast Delivery',    desc: 'Pan India shipping',          bg: 'bg-primary-100',  fg: 'text-primary-700' },
  { icon: Headphones, title: 'Expert Support',   desc: 'Technical assistance',        bg: 'bg-secondary-100',fg: 'text-secondary-600' },
  { icon: RotateCcw,  title: 'Easy Returns',     desc: '7-day return policy',         bg: 'bg-primary-50',   fg: 'text-primary-600' },
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary-900 via-secondary-800 to-slate-700" style={{ minHeight: 180 }}>
      {banner?.image && (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-secondary-900/95 via-secondary-900/70 to-transparent" />

      {/* Accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />

      {/* Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center h-full px-8 md:px-12 py-10">
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-1.5 bg-primary-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3">
            <Zap size={10} fill="currentColor" /> {banner?.subtitle || 'Premium Collection'}
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
            <Link to="/products?category=spare-parts" className="btn border border-white/20 text-secondary-300 hover:bg-white/10 hover:text-white px-5 py-2 text-sm">
              Spare Parts
            </Link>
          </div>
        </div>

        {/* Right side decorative stat cards */}
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
        <aside className="hidden lg:block w-48 shrink-0 self-start sticky z-40" style={{ top: '110px' }}>
          <CategorySidebar categories={categories} sticky />
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-4 space-y-6">

        {/* Hero */}
        <HeroSection banners={bannersData?.banners} />

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
