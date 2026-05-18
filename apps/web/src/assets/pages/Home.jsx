import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, Shield, Truck, Headphones, RotateCcw, ChevronRight } from 'lucide-react';
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
  { icon: Shield, title: '100% Genuine', desc: 'Authentic products only' },
  { icon: Truck, title: 'Fast Delivery', desc: 'Pan India shipping' },
  { icon: Headphones, title: 'Expert Support', desc: 'Technical assistance' },
  { icon: RotateCcw, title: 'Easy Returns', desc: '7-day return policy' },
];

const PROMO_BANNERS = [
  { label: 'POWER TOOLS', sub: 'Up to 40% Off', color: 'from-orange-600 to-orange-400', to: '/products?category=power-tools' },
  { label: 'SPARE PARTS', sub: 'OEM Quality', color: 'from-slate-700 to-slate-500', to: '/products?category=spare-parts' },
  { label: 'NEW ARRIVALS', sub: 'Latest Machines', color: 'from-blue-700 to-blue-500', to: '/products?featured=true' },
];

function HeroSection({ banners }) {
  const banner = banners?.[0];
  return (
    <div className="relative bg-secondary-900 overflow-hidden rounded-lg" style={{ minHeight: 280 }}>
      {banner?.image ? (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title} className="absolute inset-0 w-full h-full object-cover opacity-40" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-800 via-secondary-900 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="relative px-8 py-12 md:py-16 max-w-xl">
        <span className="inline-block bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wider mb-3">
          {banner?.subtitle || 'New Collection'}
        </span>
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
          {banner?.title || 'Professional Tools & Machinery'}
        </h1>
        <p className="mt-3 text-secondary-300 text-sm">
          Trusted by 50,000+ engineers, contractors & workshops across India
        </p>
        <div className="flex gap-3 mt-6">
          <Link to={banner?.link || '/products'} className="btn-primary">
            Shop Now <ArrowRight size={16} />
          </Link>
          <Link to="/products?category=spare-parts" className="btn border border-white/30 text-white hover:bg-white/10">
            Spare Parts
          </Link>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-8">

      {/* Hero */}
      <HeroSection banners={bannersData?.banners} />

      {/* Trust badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TRUST_BADGES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card flex items-center gap-3 px-4 py-3">
            <div className="bg-primary-50 text-primary-600 p-2 rounded shrink-0">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-secondary-900">{title}</p>
              <p className="text-[11px] text-secondary-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Shop by Category</h2>
            <Link to="/products" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
              All Categories <ChevronRight size={14} />
            </Link>
          </div>
          <CategorySidebar categories={categories} />
        </section>
      )}

      {/* Promo strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PROMO_BANNERS.map((b) => (
          <Link key={b.label} to={b.to}
            className={`relative overflow-hidden rounded-lg bg-gradient-to-r ${b.color} p-5 text-white hover:opacity-90 transition-opacity`}>
            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">{b.sub}</p>
            <p className="text-lg font-black mt-0.5">{b.label}</p>
            <ArrowRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70" />
          </Link>
        ))}
      </div>

      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Featured Products</h2>
          <Link to="/products?featured=true" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
            View All <ChevronRight size={14} />
          </Link>
        </div>
        <ProductGrid products={featuredData?.products} loading={isLoading} onAddToCart={handleAddToCart} />
      </section>

      {/* Bottom CTA strip */}
      <div className="bg-secondary-900 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-white font-bold text-lg">Need bulk orders or custom parts?</p>
          <p className="text-secondary-400 text-sm mt-0.5">Get special pricing for B2B orders and workshop requirements</p>
        </div>
        <Link to="/info/contact" className="btn-primary shrink-0">
          Contact Us <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
