import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingCart, Star, Shield, ChevronDown, ChevronUp, MapPin, CheckCircle, XCircle, Heart } from 'lucide-react';
import api from '../../utils/api';
import { setCart } from '../../store/slices/cartSlice';
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
  const { user } = useSelector((s) => s.auth);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState(null);

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

  async function addToCart() {
    setAdding(true);
    try {
      const { data: cartData } = await api.post('/cart/items', { productId: product._id, quantity: qty });
      dispatch(setCart(cartData.cart));
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart');
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

  const discount = product.compareAt > product.price
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6">
      <nav className="text-sm text-secondary-500 mb-4 flex gap-2">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary-600">Products</Link>
        <span>/</span>
        <span className="text-secondary-800 truncate">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-3">
          <div className="aspect-square rounded-xl overflow-hidden bg-secondary-50">
            {product.images?.[activeImg] ? (
              <img src={normalizeImageUrl(product.images[activeImg])} alt={product.imageAlts?.[activeImg] || product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-secondary-300"><ShoppingCart size={64} /></div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-primary-500' : 'border-secondary-200'}`}>
                  <img src={normalizeImageUrl(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {product.brand && <p className="text-sm text-secondary-400 uppercase tracking-wide">{product.brand}</p>}
          <h1 className="text-2xl md:text-3xl font-bold text-secondary-900">{product.title}</h1>

          {product.rating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">{Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={16} className={i < Math.round(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200'} />
              ))}</div>
              <span className="text-sm text-secondary-500">{product.rating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>
          )}

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-secondary-900">{formatCurrency(product.price)}</span>
            {product.compareAt > product.price && (
              <>
                <span className="text-lg text-secondary-400 line-through">{formatCurrency(product.compareAt)}</span>
                <span className="bg-green-100 text-green-700 text-sm font-medium px-2 py-0.5 rounded-full">{discount}% off</span>
              </>
            )}
          </div>

          {product.stock > 0 ? (
            <p className="text-sm text-green-600 font-medium">
              In stock {product.stock <= (product.lowStockThreshold || 5) && `— only ${product.stock} left`}
            </p>
          ) : (
            <p className="text-sm text-red-500 font-medium">Out of stock</p>
          )}

          {product.stock > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-secondary-300 rounded-lg">
                <button className="px-3 py-2 text-secondary-600 hover:bg-secondary-50 disabled:opacity-40"
                  onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>−</button>
                <span className="px-4 py-2 text-sm font-medium">{qty}</span>
                <button className="px-3 py-2 text-secondary-600 hover:bg-secondary-50 disabled:opacity-40"
                  onClick={() => setQty(Math.min(product.stock, qty + 1))} disabled={qty >= product.stock}>+</button>
              </div>
              <button className="btn-primary flex-1" onClick={addToCart} disabled={adding}>
                {adding ? <Spinner size="sm" /> : <ShoppingCart size={16} />}
                Add to Cart
              </button>
              <button
                onClick={toggleWishlist}
                disabled={wishlistLoading}
                className={`p-2.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  wishlisted
                    ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                    : 'border-secondary-300 text-secondary-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50'
                }`}
                title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart size={18} className={wishlisted ? 'fill-red-500' : ''} />
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
          <div className="border border-secondary-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5"><MapPin size={14} className="text-primary-600" /> Check Delivery</p>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '')); setPincodeStatus(null); }}
                onKeyDown={(e) => e.key === 'Enter' && checkPincode()}
                placeholder="Enter 6-digit pincode"
                className="input flex-1 text-sm"
              />
              <button
                onClick={checkPincode}
                disabled={pincodeStatus === 'checking'}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {pincodeStatus === 'checking' ? '...' : 'Check'}
              </button>
            </div>
            {pincodeStatus === 'available' && (
              <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
                <CheckCircle size={13} /> Delivery available to {pincode} — estimated 3–5 business days
              </p>
            )}
            {pincodeStatus === 'unavailable' && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <XCircle size={13} /> {!/^\d{6}$/.test(pincode) ? 'Enter a valid 6-digit pincode' : `Delivery not available to ${pincode}`}
              </p>
            )}
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
    </div>
  );
}
