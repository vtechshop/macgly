import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { MapPin, Truck, CreditCard, Check, ChevronRight, Zap, Package } from 'lucide-react';
import api from '../../utils/api';
import { clearCart } from '../../store/slices/cartSlice';
import { formatCurrency } from '../../utils/format';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard Delivery', desc: '3–7 business days', charge: 70, icon: Package },
  { id: 'express', label: 'Express Delivery', desc: '1–2 business days', charge: 120, icon: Zap },
];

const STEPS = [
  { num: 1, label: 'Address', icon: MapPin },
  { num: 2, label: 'Shipping', icon: Truck },
  { num: 3, label: 'Payment', icon: CreditCard },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, idx) => {
        const done = current > step.num;
        const active = current === step.num;
        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors
                ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-secondary-200 text-secondary-500'}`}>
                {done ? <Check size={16} /> : step.num}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-blue-600' : done ? 'text-secondary-600' : 'text-secondary-400'}`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-colors ${current > step.num ? 'bg-blue-600' : 'bg-secondary-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderSummary({ items, subtotal, shippingCharge, discount, coupon, couponCode, setCouponCode, onApplyCoupon, onRemoveCoupon, applyingCoupon }) {
  const gstAmount = parseFloat(
    items.reduce((sum, i) => sum + (i.price * i.quantity * (i.product?.gstRate ?? 18)) / (100 + (i.product?.gstRate ?? 18)), 0).toFixed(2)
  );
  const total = Math.max(0, subtotal + shippingCharge - discount);

  return (
    <div className="bg-white border border-secondary-200 rounded-xl p-5 space-y-3 sticky top-4">
      <h3 className="font-semibold text-secondary-800">Order Summary</h3>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item._id} className="flex justify-between text-sm gap-2">
            <span className="text-secondary-600 line-clamp-1 flex-1">{item.product?.title} × {item.quantity}</span>
            <span className="shrink-0 font-medium">{formatCurrency(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-secondary-100 pt-2 space-y-1.5 text-sm">
        <div className="flex justify-between text-secondary-600">
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-secondary-400 text-xs">
          <span>GST (incl.)</span><span>{formatCurrency(gstAmount)}</span>
        </div>
        <div className="flex justify-between text-secondary-600">
          <span>Shipping</span>
          <span>{shippingCharge === 0 ? <span className="text-secondary-400 italic">TBD</span> : formatCurrency(shippingCharge)}</span>
        </div>
        {coupon && (
          <div className="flex justify-between text-green-700">
            <span>Coupon ({coupon.code})</span><span>-{formatCurrency(discount)}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between font-bold text-lg border-t border-secondary-200 pt-2">
        <span>Total</span><span>{formatCurrency(total)}</span>
      </div>
      {!coupon ? (
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm py-1.5"
            placeholder="Coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && onApplyCoupon()}
          />
          <Button variant="outline" onClick={onApplyCoupon} loading={applyingCoupon} className="shrink-0 text-sm py-1.5 px-3">Apply</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
          <span className="text-green-700 font-medium">{coupon.code} applied</span>
          <button onClick={onRemoveCoupon} className="text-green-600 hover:text-green-800 text-xs underline">Remove</button>
        </div>
      )}
    </div>
  );
}

export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const [step, setStep] = useState(1);
  const [cart, setCart] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [address, setAddress] = useState({
    name: user?.name || '', phone: user?.phone || '',
    line1: '', line2: '', city: '', state: '', pincode: '',
  });
  const [errors, setErrors] = useState({});

  const [shippingOption, setShippingOption] = useState(SHIPPING_OPTIONS[0].id);
  const shippingCharge = SHIPPING_OPTIONS.find((o) => o.id === shippingOption)?.charge ?? 70;

  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/cart'),
      api.get('/users/profile').catch(() => null),
    ]).then(([cartRes, profileRes]) => {
      const c = cartRes.data.cart;
      if (!c?.items?.length) {
        toast.error('Your cart is empty');
        navigate('/products');
        return;
      }
      setCart(c);
      if (profileRes?.data?.user?.addresses?.length) {
        setSavedAddresses(profileRes.data.user.addresses);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
      toast.error('Could not load cart');
      navigate('/cart');
    });
  }, [navigate]);

  const items = cart?.items || [];
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = coupon?.discount || 0;
  const total = Math.max(0, subtotal + shippingCharge - discount);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const { data } = await api.post('/cart/coupon', { code: couponCode.trim().toUpperCase() });
      setCoupon({ code: couponCode.trim().toUpperCase(), discount: data.discount });
      toast.success(`Coupon applied! You save ${formatCurrency(data.discount)}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid coupon');
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() { setCoupon(null); setCouponCode(''); }

  function setField(k) { return (e) => setAddress((p) => ({ ...p, [k]: e.target.value })); }

  async function handlePincodeChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setAddress((p) => ({ ...p, pincode: val }));
    if (val.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const json = await res.json();
        const po = json?.[0]?.PostOffice?.[0];
        if (po) setAddress((p) => ({ ...p, state: po.State || p.state, city: po.District || p.city }));
      } catch { /* silent */ }
    }
  }

  function validateAddress() {
    const errs = {};
    if (!address.name.trim()) errs.name = 'Full name is required';
    if (!address.phone.trim()) { errs.phone = 'Phone number is required'; }
    else if (!/^\d{10}$/.test(address.phone.replace(/[\s+\-() ]/g, ''))) errs.phone = 'Enter a valid 10-digit phone number';
    if (!address.line1.trim()) errs.line1 = 'Address is required';
    if (!address.city.trim()) errs.city = 'City is required';
    if (!address.state.trim()) errs.state = 'State is required';
    if (!address.pincode.trim()) { errs.pincode = 'Pincode is required'; }
    else if (!/^\d{6}$/.test(address.pincode.trim())) errs.pincode = 'Enter a valid 6-digit pincode';
    return errs;
  }

  function handleStep1Continue() {
    const errs = validateAddress();
    if (Object.keys(errs).length) { setErrors(errs); toast.error('Please fix the errors'); return; }
    setErrors({});
    setStep(2);
    window.scrollTo(0, 0);
  }

  function getStoredAffRef() {
    try {
      const raw = localStorage.getItem('aff_ref');
      if (!raw) return null;
      const { ref, expires } = JSON.parse(raw);
      if (Date.now() > expires) { localStorage.removeItem('aff_ref'); return null; }
      return ref;
    } catch { return null; }
  }

  async function handlePlaceOrder() {
    setPlacing(true);
    const affiliateRef = getStoredAffRef();
    try {
      const { data } = await api.post('/orders', {
        shippingAddress: address,
        paymentMethod,
        couponCode: coupon?.code,
        affiliateRef,
        shippingCharge,
      });
      if (paymentMethod === 'razorpay' && data.razorpayOrder) {
        const options = {
          key: data.razorpayKey,
          amount: data.razorpayOrder.amount,
          currency: 'INR',
          order_id: data.razorpayOrder.id,
          name: 'Macgly',
          description: 'Order Payment',
          handler: async (response) => {
            try {
              await api.post('/payments/verify', response);
              localStorage.removeItem('aff_ref');
              dispatch(clearCart());
              navigate(`/order-confirmation/${data.order._id}`);
            } catch { toast.error('Payment verification failed'); }
          },
          prefill: { name: user?.name, email: user?.email, contact: user?.phone },
          theme: { color: '#2563eb' },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        localStorage.removeItem('aff_ref');
        dispatch(clearCart());
        toast.success('Order placed successfully!');
        navigate(`/order-confirmation/${data.order._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const summaryProps = {
    items, subtotal,
    shippingCharge: step >= 2 ? shippingCharge : 0,
    discount, coupon, couponCode, setCouponCode,
    onApplyCoupon: handleApplyCoupon, onRemoveCoupon: removeCoupon, applyingCoupon,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StepIndicator current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">

          {/* Step 1: Address */}
          {step === 1 && (
            <div className="bg-white border border-secondary-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-blue-600" />
                <h2 className="font-bold text-secondary-800 text-lg">Delivery Address</h2>
              </div>

              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Saved Addresses</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {savedAddresses.map((a) => {
                      const isSelected = address.line1 === a.line1 && address.pincode === a.pincode && address.name === a.name;
                      return (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() => setAddress({ name: a.name || '', phone: a.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '' })}
                          className={`text-left p-3 rounded-lg border transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-secondary-200 hover:border-secondary-300 hover:bg-secondary-50'}`}
                        >
                          <p className="text-xs font-bold text-secondary-400 uppercase mb-0.5">{a.label || 'Address'}</p>
                          <p className="text-sm font-medium text-secondary-800">{a.name}</p>
                          <p className="text-xs text-secondary-500 leading-relaxed mt-0.5">{a.line1}, {a.city}, {a.state} – {a.pincode}</p>
                          {a.isDefault && <span className="text-[10px] text-blue-600 font-bold">Default</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary-200" /></div>
                    <div className="relative flex justify-center"><span className="px-3 bg-white text-xs text-secondary-400">or enter new address</span></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input label="Full Name *" value={address.name} onChange={(e) => { setField('name')(e); setErrors((p) => ({ ...p, name: '' })); }} error={errors.name} className="col-span-2" />
                <Input label="Phone *" type="tel" value={address.phone} onChange={(e) => { setField('phone')(e); setErrors((p) => ({ ...p, phone: '' })); }} error={errors.phone} />
                <Input label="Pincode *" value={address.pincode} onChange={(e) => { handlePincodeChange(e); setErrors((p) => ({ ...p, pincode: '' })); }} maxLength={6} error={errors.pincode} />
                <Input label="Address Line 1 *" value={address.line1} onChange={(e) => { setField('line1')(e); setErrors((p) => ({ ...p, line1: '' })); }} error={errors.line1} className="col-span-2" />
                <Input label="Address Line 2 (optional)" value={address.line2} onChange={setField('line2')} className="col-span-2" />
                <Input label="City *" value={address.city} onChange={(e) => { setField('city')(e); setErrors((p) => ({ ...p, city: '' })); }} error={errors.city} />
                <Input label="State *" value={address.state} onChange={(e) => { setField('state')(e); setErrors((p) => ({ ...p, state: '' })); }} error={errors.state} />
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={handleStep1Continue} className="px-8">
                  Continue to Shipping <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Shipping */}
          {step === 2 && (
            <div className="bg-white border border-secondary-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Truck size={20} className="text-blue-600" />
                <h2 className="font-bold text-secondary-800 text-lg">Shipping Method</h2>
              </div>

              <div className="text-sm text-secondary-500 bg-secondary-50 rounded-lg px-4 py-2.5">
                Delivering to: <span className="font-semibold text-secondary-700">{address.line1}, {address.city}, {address.state} – {address.pincode}</span>
                <button onClick={() => setStep(1)} className="ml-2 text-blue-600 hover:underline text-xs">Change</button>
              </div>

              <div className="space-y-3">
                {SHIPPING_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = shippingOption === opt.id;
                  return (
                    <label key={opt.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-secondary-200 hover:border-secondary-300'}`}>
                      <input type="radio" name="shipping" className="sr-only" checked={selected} onChange={() => setShippingOption(opt.id)} />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-blue-100' : 'bg-secondary-100'}`}>
                        <Icon size={20} className={selected ? 'text-blue-600' : 'text-secondary-500'} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-secondary-800">{opt.label}</p>
                        <p className="text-sm text-secondary-500">{opt.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-base ${selected ? 'text-blue-600' : 'text-secondary-700'}`}>{formatCurrency(opt.charge)}</p>
                      </div>
                      {selected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => { setStep(3); window.scrollTo(0, 0); }} className="px-8">
                  Continue to Payment <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="bg-white border border-secondary-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <CreditCard size={20} className="text-blue-600" />
                <h2 className="font-bold text-secondary-800 text-lg">Payment Method</h2>
              </div>

              <div className="space-y-3">
                {/* Online Payment — shown first and prominently */}
                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'razorpay' ? 'border-blue-500 bg-blue-50' : 'border-secondary-200 hover:border-secondary-300'}`}>
                  <input type="radio" name="payment" className="sr-only" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${paymentMethod === 'razorpay' ? 'bg-blue-100' : 'bg-secondary-100'}`}>
                    <CreditCard size={20} className={paymentMethod === 'razorpay' ? 'text-blue-600' : 'text-secondary-500'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-secondary-800">Online Payment</p>
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">RECOMMENDED</span>
                    </div>
                    <p className="text-sm text-secondary-500 mt-0.5">UPI, Debit/Credit Card, Net Banking, Wallets</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {['UPI', 'GPay', 'PhonePe', 'Paytm', 'VISA', 'MC'].map((b) => (
                        <span key={b} className="text-[10px] font-bold border border-secondary-200 px-1.5 py-0.5 rounded text-secondary-500 bg-white">{b}</span>
                      ))}
                    </div>
                  </div>
                  {paymentMethod === 'razorpay' && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </label>

                {/* COD */}
                <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-blue-500 bg-blue-50' : 'border-secondary-200 hover:border-secondary-300'}`}>
                  <input type="radio" name="payment" className="sr-only" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === 'cod' ? 'bg-blue-100' : 'bg-secondary-100'}`}>
                    <Package size={20} className={paymentMethod === 'cod' ? 'text-blue-600' : 'text-secondary-500'} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-secondary-800">Cash on Delivery</p>
                    <p className="text-sm text-secondary-500">Pay in cash when your order arrives</p>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </label>
              </div>

              {/* Order review summary on mobile */}
              <div className="lg:hidden bg-secondary-50 rounded-xl p-4 space-y-1.5 text-sm">
                <p className="font-semibold text-secondary-700 mb-2">Order Total</p>
                <div className="flex justify-between text-secondary-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-secondary-600"><span>Shipping</span><span>{formatCurrency(shippingCharge)}</span></div>
                {coupon && <div className="flex justify-between text-green-700"><span>Coupon</span><span>-{formatCurrency(discount)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t border-secondary-200 pt-2 mt-1">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handlePlaceOrder} loading={placing} className="px-8 text-base font-bold">
                  {paymentMethod === 'cod' ? 'Place Order' : `Pay ${formatCurrency(total)}`}
                </Button>
              </div>

              <p className="text-center text-xs text-secondary-400">
                By placing your order, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar — Order Summary */}
        <div className="hidden lg:block">
          <OrderSummary {...summaryProps} />
        </div>
      </div>
    </div>
  );
}
