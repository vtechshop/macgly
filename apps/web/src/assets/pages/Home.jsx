import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, ChevronRight, Sprout } from 'lucide-react';
import api from '../../utils/api';
import CategorySidebar from '../components/common/CategorySidebar';
import ProductCard from '../components/product/ProductCard';
import { useFetch } from '../../hooks';
import { normalizeImageUrl } from '../../utils/format';
import { setMeta } from '../../utils/seo';



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
      minHeight: 300,
      background: 'linear-gradient(135deg, #0c1520 0%, #162035 50%, #1a2a3e 100%)',
    }}>
      {banner?.image && (
        <img src={normalizeImageUrl(banner.image)} alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover opacity-15" />
      )}

      {/* depth layers */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* orange glow — right */}
      <div className="absolute top-0 right-0 bottom-0 w-1/2 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 75% 45%, rgba(249,115,22,0.18) 0%, transparent 60%)',
      }} />

      {/* left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: 'linear-gradient(180deg, #fdba74, #f97316, #c2410c)' }} />

      <div className="relative flex items-center h-full px-8 md:px-12 py-10 gap-6">
        {/* Left: text */}
        <div className="flex-1 max-w-xl">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.15em] mb-5"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.35)' }}>
            <Sprout size={9} /> {banner?.subtitle || 'Premium Industrial Collection'}
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

        {/* Right: stat cards — desktop */}
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

  const { data: bannersData }    = useFetch(['banners'],       () => api.get('/catalog/banners').then((r) => r.data));
  const { data: categoriesData } = useFetch(['categories'],    () => api.get('/catalog/categories').then((r) => r.data));
  const { data: productsData }   = useFetch(['home-products'], () => api.get('/catalog/products', { params: { limit: 8 } }).then((r) => r.data));

  const categories   = categoriesData?.categories || [];
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
