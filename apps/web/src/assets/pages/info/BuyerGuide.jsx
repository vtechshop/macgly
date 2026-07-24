import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, CreditCard, Package, RotateCcw, Shield, Truck, CheckCircle } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

const STEPS = [
  {
    icon: Search,
    title: 'Find what you need',
    desc: 'Use the search bar or browse by category. Filter by brand, price range, and rating to narrow down your options. Each product page shows full specifications, images, GST details, and real customer reviews.',
    tips: [
      'Use specific terms like "angle grinder 4 inch 850W" for better results',
      'Check the brand filter — we carry authorised stock from leading brands',
      'Read the specifications table before adding to cart',
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Add to cart and review',
    desc: 'Add items to your cart and review your order. Check the quantity, confirm the variant (size, voltage, capacity) if applicable, and use the pin code checker to verify delivery availability to your location.',
    tips: [
      'Use the pin code checker on the product page to confirm serviceability',
      'For urgent requirements, check the stock status — "Only X left" means limited stock',
      'Bulk orders? Contact us on WhatsApp for special pricing before placing the order',
    ],
  },
  {
    icon: CreditCard,
    title: 'Checkout and pay',
    desc: 'Create a free account or sign in, enter your delivery address, choose your shipping option, and pay securely. We accept UPI, cards (Visa, Mastercard, RuPay), Net Banking, and EMI on eligible cards via Razorpay.',
    tips: [
      'Save your GST details in your profile for automatic invoice generation',
      'UPI is the fastest and most reliable payment method',
      'EMI is available on orders above ₹3,000 on select cards',
    ],
  },
  {
    icon: Truck,
    title: 'Track your delivery',
    desc: 'Once dispatched, you\'ll receive an SMS and email with your tracking link. You can also track orders anytime from your account dashboard under My Orders. Standard delivery takes 3–7 business days.',
    tips: [
      'Metro cities typically receive orders in 2–4 business days',
      'If tracking shows "out for delivery", someone should be available to receive the package',
      'Inspect the outer packaging before signing the delivery receipt',
    ],
  },
  {
    icon: Package,
    title: 'Inspect on delivery',
    desc: 'When your order arrives, inspect the outer packaging before accepting. Open and check the product against your order. Report any damage, missing accessories, or wrong items within 48 hours.',
    tips: [
      'Check the model number and brand on the product against the invoice',
      'Test the product for basic functionality within the return window',
      'Keep all original packaging until you\'re satisfied with the product',
    ],
  },
  {
    icon: RotateCcw,
    title: 'Returns and warranty',
    desc: 'Changed your mind? Return unused products in original packaging within 7 days. For defects covered under manufacturer warranty, use our Warranty Check tool with your order ID.',
    tips: [
      'Initiate returns from your account dashboard — no need to call',
      'For warranty repairs, we coordinate with the vendor on your behalf',
      'GST invoice is automatically generated and downloadable from your order page',
    ],
  },
];

export default function BuyerGuide() {
  useEffect(() => {
    setMeta({
      title: 'Buyer\'s Guide — How to Shop on Macgly',
      description: 'A step-by-step guide to buying tools and machinery on Macgly — from finding the right product to tracking your delivery and making warranty claims.',
      canonical: 'https://www.macgly.com/info/buyer-guide',
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Buyer's Guide</h1>
      <p className="text-secondary-500 mb-10 text-sm leading-relaxed">
        First time buying on Macgly? This guide walks you through everything — from finding the right product to getting it delivered and covered under warranty.
      </p>

      <div className="space-y-8">
        {STEPS.map(({ icon: Icon, title, desc, tips }, i) => (
          <div key={title} className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Icon size={18} />
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px flex-1 bg-secondary-200 mt-3" />
              )}
            </div>
            <div className="pb-8 flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-0.5">Step {i + 1}</p>
              <h2 className="text-lg font-bold text-secondary-900 mb-2">{title}</h2>
              <p className="text-sm text-secondary-600 leading-relaxed mb-3">{desc}</p>
              <ul className="space-y-1.5">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-secondary-500">
                    <CheckCircle size={12} className="text-primary-400 shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {[
          { icon: Shield, label: 'Genuine Products', sub: 'Every item verified for authenticity' },
          { icon: Truck, label: 'Pan India Delivery', sub: '20,000+ pin codes served' },
          { icon: RotateCcw, label: '7-Day Returns', sub: 'Hassle-free, no questions asked' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="card p-4 text-center">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Icon size={18} />
            </div>
            <p className="font-semibold text-secondary-900 text-sm">{label}</p>
            <p className="text-xs text-secondary-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/products" className="btn-primary">Start Shopping</Link>
        <Link to="/info/faq" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">Read FAQs</Link>
        <Link to="/info/contact" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">Contact Support</Link>
      </div>
    </div>
  );
}
