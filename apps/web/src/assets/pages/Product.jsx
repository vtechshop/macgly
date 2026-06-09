import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingCart, Star, Shield, ChevronDown, ChevronUp, MapPin, CheckCircle, XCircle, Heart, Zap, Truck } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import api from '../../utils/api';
import { setCart, addItemOptimistic, openCartDrawer } from '../../store/slices/cartSlice';
import { formatCurrency, normalizeImageUrl } from '../../utils/format';
import { productJsonLd, injectJsonLd, setMeta } from '../../utils/seo';
import { useFetch } from '../../hooks';
import Spinner from '../components/common/Spinner';
import ReviewSection from '../components/product/ReviewSection';
import toast from 'react-hot-toast';

function AccordionSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-secondary-200">
      <button className="flex items-center justify-between w-full py-4 text-left font-medium" onClick={() => setOpen(!open)}>
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="pb-4 text-sm text-secondary-600">{children}</div>}
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState(null);
  const [selectedAttributes, setSelectedAttributes] = useState({});

  async function checkPincode() {
    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      setPincodeStatus('unavailable');
      return;
    }
    setPincodeStatus('checking');
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const json = await res.json();
      const status = json?.[0]?.Status;
      setPincodeStatus(status === 'Success' ? 'available' : 'unavailable');
    } catch {
      setPincodeStatus('unavailable');
    }
  }

  const { data, isLoading, error } = useFetch(
    ['product', slug],
    () => api.get(`/catalog/products/${slug}`).then((r) => r.data)
  );

  const categorySlug = data?.product?.category?.slug || data?.product?.category;
  const { data: relatedData } = useFetch(
    categorySlug ? ['related', categorySlug, slug] : null,
    () => api.get('/catalog/products', { params: { category: categorySlug, limit: 8 } }).then((r) => r.data)
  );

  const product = data?.product;

  // Check wishlist status once product and user are known
  useEffect(() => {
    if (!product || !user) return;
    api.get('/users/wishlist/ids')
      .then(({ data: d }) => setWishlisted(d.ids.includes(product._id)))
      .catch(() => {});
  }, [product?._id, user?._id]);

  useEffect(() => {
    if (!product) return;
    setMeta({
      title: product.seo?.title || `${product.title} — Macgly`,
      description: product.seo?.description || product.description?.slice(0, 160),
    });
    injectJsonLd(productJsonLd(product));
  }, [product]);

  // Derive selected variant
  const selectedVariant = product?.hasVariants
    ? (product.variants || []).find((v) => {
        const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {});
        return Object.keys(selectedAttributes).length > 0 &&
          Object.entries(selectedAttributes).every(([k, val]) => attrs[k] === val);
      })
    : null;

  const activePrice = selectedVariant?.price ?? product?.price;
  const activeCompareAt = selectedVariant?.compareAt ?? product?.compareAt;
  const activeStock = product?.hasVariants
    ? (selectedVariant?.stock ?? 0)
    : (product?.stock ?? 0);

  async function addToCart() {
    if (product.hasVariants && !selectedVariant) {
      toast.error('Please select all options');
      return;
    }
    dispatch(addItemOptimistic({ product: { ...product, price: activePrice }, quantity: qty }));
    dispatch(openCartDrawer(product));
    toast.success('Added to cart');
    api.post('/cart/items', { productId: product._id, quantity: qty, variantId: selectedVariant?._id })
      .then(({ data }) => dispatch(setCart(data.cart)))
      .catch(() => {
        toast.error('Could not sync cart');
        api.get('/cart').then(({ data }) => { if (data.cart) dispatch(setCart(data.cart)); }).catch(() => {});
      });
  }

  async function buyNow() {
    if (product.hasVariants && !selectedVariant) {
      toast.error('Please select all options');
      return;
    }
    setAdding(true);
    try {
      const { data: cartData } = await api.post('/cart/items', { productId: product._id, quantity: qty, variantId: selectedVariant?._id });
      dispatch(setCart(cartData.cart));
      navigate('/checkout');
    } catch {
      toast.error('Could not process');
    } finally {
      setAdding(false);
    }
  }

  async function toggleWishlist() {
    if (!user) { toast.error('Please login to save to wishlist'); return; }
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await api.delete(`/users/wishlist/${product._id}`);
        setWishlisted(false);
        toast.success('Removed from wishlist');
      } else {
        await api.post(`/users/wishlist/${product._id}`);
        setWishlisted(true);
        toast.success('Saved to wishlist');
      }
    } catch { toast.error('Could not update wishlist'); }
    finally { setWishlistLoading(false); }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (error || !product) return (
    <div className="px-4 sm:px-6 lg:px-10 py-20 text-center">
      <p className="text-lg font-medium">Product not found</p>
      <Link to="/products" className="text-primary-600 hover:underline mt-2 inline-block">Browse products</Link>
    </div>
  );

  const discount = activeCompareAt > activePrice
    ? Math.round(((activeCompareAt - activePrice) / activeCompareAt) * 100)
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6">
      <nav className="text-sm text-secondary-500 mb-4 flex gap-2 flex-wrap">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary-600">Products</Link>
        {categorySlug && (
          <>
            <span>/</span>
            <Link to={`/category/${categorySlug}`} className="hover:text-primary-600 capitalize">
              {product.category?.name || categorySlug.replace(/-/g, ' ')}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-secondary-800 truncate">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-white border border-secondary-200 shadow-sm flex items-center justify-center" style={{ height: 580 }}>
            <ShoppingCart size={48} className="text-secondary-200" />
            {product.images?.[activeImg] && (
              <img src={normalizeImageUrl(product.images[activeImg])} alt={product.imageAlts?.[activeImg] || product.title} className="absolute inset-0 w-full h-full object-contain p-3" onError={(e) => e.currentTarget.remove()} />
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors bg-white ${i === activeImg ? 'border-primary-500' : 'border-secondary-200 hover:border-secondary-400'}`}>
                  <img src={normalizeImageUrl(img)} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Brand row */}
          <div className="flex items-center">
            {product.brand
              ? <p className="text-xs font-bold uppercase tracking-widest text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{product.brand}</p>
              : null}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-secondary-900 leading-snug">{product.title}</h1>

          {product.rating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">{Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={15} className={i < Math.round(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200 fill-secondary-200'} />
              ))}</div>
              <span className="text-sm text-secondary-500">{product.rating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>
          )}

          {/* Variant selectors */}
          {product.hasVariants && product.variantOptions?.length > 0 && (
            <div className="space-y-3">
              {product.variantOptions.map((opt) => (
                <div key={opt.name} className="space-y-1.5">
                  <p className="text-sm font-semibold text-secondary-700">{opt.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((val) => {
                      const isSelected = selectedAttributes[opt.name] === val;
                      const testAttrs = { ...selectedAttributes, [opt.name]: val };
                      const matchVariant = product.variants?.find((v) => {
                        const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {});
                        return Object.entries(testAttrs).every(([k, vv]) => attrs[k] === vv);
                      });
                      const isUnavailable = product.variantOptions.length === 1 && matchVariant && matchVariant.stock === 0;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSelectedAttributes((prev) => ({ ...prev, [opt.name]: val }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : isUnavailable
                              ? 'border-secondary-200 text-secondary-300 line-through cursor-not-allowed'
                              : 'border-secondary-300 text-secondary-700 hover:border-primary-400 hover:bg-primary-50/50'
                          }`}
                          disabled={isUnavailable}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Price card */}
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-secondary-900">{formatCurrency(activePrice)}</span>
              {activeCompareAt > activePrice && (
                <>
                  <span className="text-base text-secondary-400 line-through">{formatCurrency(activeCompareAt)}</span>
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">{discount}% OFF</span>
                </>
              )}
            </div>
            {activeCompareAt > activePrice && (
              <p className="text-xs text-secondary-500">You save {formatCurrency(activeCompareAt - activePrice)}</p>
            )}
          </div>

          {/* Stock */}
          {activeStock > 0 ? (
            <p className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
              <CheckCircle size={15} className="shrink-0" />
              In Stock
              {activeStock <= (product.lowStockThreshold || 5) && (
                <span className="text-orange-500 flex items-center gap-0.5 ml-1"><Zap size={12} /> Only {activeStock} left</span>
              )}
            </p>
          ) : product.hasVariants && Object.keys(selectedAttributes).length < (product.variantOptions?.length || 0) ? (
            <p className="text-sm text-secondary-500 font-medium">Select options to check availability</p>
          ) : (
            <p className="text-sm text-red-500 font-semibold flex items-center gap-1.5"><XCircle size={15} /> Out of Stock</p>
          )}

          {activeStock > 0 && (
            <div className="space-y-3">
              {/* Quantity */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-secondary-600 font-medium">Quantity:</span>
                <div className="flex items-center border border-secondary-300 rounded-lg overflow-hidden bg-white">
                  <button className="w-9 h-9 flex items-center justify-center text-secondary-600 hover:bg-secondary-100 disabled:opacity-40 text-lg transition-colors"
                    onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>−</button>
                  <span className="w-12 text-center text-sm font-bold text-secondary-900 border-x border-secondary-200 h-9 flex items-center justify-center">{qty}</span>
                  <button className="w-9 h-9 flex items-center justify-center text-secondary-600 hover:bg-secondary-100 disabled:opacity-40 text-lg transition-colors"
                    onClick={() => setQty(Math.min(activeStock, qty + 1))} disabled={qty >= activeStock}>+</button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 text-sm shadow"
                  onClick={addToCart} disabled={adding}
                >
                  {adding ? <Spinner size="sm" /> : <ShoppingCart size={16} />}
                  Add to Cart
                </button>
                <button
                  className="flex items-center justify-center gap-2 py-3 bg-secondary-800 hover:bg-secondary-900 text-white font-bold rounded-xl transition-colors disabled:opacity-60 text-sm shadow"
                  onClick={buyNow} disabled={adding}
                >
                  <Zap size={16} />
                  Buy Now
                </button>
              </div>

              {/* Wishlist */}
              <button
                onClick={toggleWishlist}
                disabled={wishlistLoading}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors disabled:opacity-50 ${
                  wishlisted
                    ? 'border-red-400 bg-red-50 text-red-500'
                    : 'border-secondary-300 text-secondary-600 hover:border-red-400 hover:bg-red-50 hover:text-red-500'
                }`}
              >
                <Heart size={16} className={wishlisted ? 'fill-red-500' : ''} />
                {wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
              </button>
            </div>
          )}

          {product.warranty?.duration && (
            <div className="flex items-center gap-2 text-sm text-secondary-600 bg-secondary-50 rounded-lg p-3">
              <Shield size={16} className="text-primary-600 shrink-0" />
              <span>{product.warranty.duration} {product.warranty.durationType} warranty — {product.warranty.description}</span>
            </div>
          )}

          {/* Pincode checker */}
          <div className="rounded-xl border border-secondary-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary-50 border-b border-secondary-200">
              <Truck size={15} className="text-primary-600 shrink-0" />
              <span className="text-sm font-semibold text-secondary-700">Check Delivery</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '')); setPincodeStatus(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && checkPincode()}
                    placeholder="Enter 6-digit pincode"
                    className="input pl-8 text-sm w-full font-mono tracking-widest"
                  />
                </div>
                <button
                  onClick={checkPincode}
                  disabled={pincodeStatus === 'checking'}
                  className="px-5 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {pincodeStatus === 'checking' ? '...' : 'Check'}
                </button>
              </div>
              {pincodeStatus === 'available' && (
                <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Delivery available to {pincode}</p>
                    <p className="text-xs text-green-600 mt-0.5">Estimated delivery: 3–5 business days</p>
                  </div>
                </div>
              )}
              {pincodeStatus === 'unavailable' && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-600">
                    {!/^\d{6}$/.test(pincode) ? 'Enter a valid 6-digit pincode' : `Delivery not available to ${pincode}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-secondary-600 leading-relaxed">{product.description}</p>

          {product.specifications?.length > 0 && (
            <AccordionSection title="Specifications">
              <table className="w-full">
                <tbody>
                  {product.specifications.map((s, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-secondary-50' : ''}>
                      <td className="py-1.5 px-2 font-medium w-40">{s.label}</td>
                      <td className="py-1.5 px-2">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionSection>
          )}

          {product.faqs?.length > 0 && (
            <AccordionSection title="FAQs">
              <div className="space-y-3">
                {product.faqs.map((f, i) => (
                  <div key={i}>
                    <p className="font-medium text-secondary-800">{f.question}</p>
                    <p className="mt-1 text-secondary-600">{f.answer}</p>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}
        </div>
      </div>

      <ReviewSection key={product._id} productId={product._id} />

      {/* Related products */}
      {relatedData?.products?.filter(p => p._id !== product._id).length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-black text-secondary-900 mb-4">You may also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {relatedData.products
              .filter(p => p._id !== product._id)
              .slice(0, 5)
              .map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
