import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

const FAQS = [
  {
    category: 'Ordering',
    items: [
      {
        q: 'How do I place an order?',
        a: 'Browse our catalogue, add products to your cart, and proceed to checkout. You\'ll need to create a free account to complete your purchase. We accept orders 24/7 and you\'ll receive an email confirmation once your order is placed.',
      },
      {
        q: 'Can I modify or cancel my order after placing it?',
        a: 'You can request a modification or cancellation within 2 hours of placing your order by contacting us on WhatsApp (+91 99445 56683) or via the Contact page. Once the order is picked up by our logistics partner, cancellations are no longer possible.',
      },
      {
        q: 'Do you accept bulk or B2B orders?',
        a: 'Yes. For orders above ₹50,000 or bulk quantities, contact us directly on WhatsApp or via the Contact page with your requirement. We offer custom pricing, credit terms, and priority fulfillment for verified business buyers.',
      },
    ],
  },
  {
    category: 'Payments',
    items: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept UPI (GPay, PhonePe, Paytm, BHIM), Credit/Debit cards (Visa, Mastercard, RuPay), Net Banking, and EMI on eligible cards. All payments are processed securely via Razorpay.',
      },
      {
        q: 'Do you provide GST invoices?',
        a: 'Yes — a GST-compliant tax invoice is automatically generated for every order. You can download it from your order details page in your account dashboard. This can be used for input tax credit (ITC) claims.',
      },
      {
        q: 'Is it safe to pay online on Macgly?',
        a: 'Absolutely. All transactions are encrypted (TLS/SSL) and processed by Razorpay, a PCI-DSS Level 1 compliant payment gateway. We never store your card details.',
      },
    ],
  },
  {
    category: 'Shipping & Delivery',
    items: [
      {
        q: 'Do you ship across India?',
        a: 'Yes. We deliver to 20,000+ pin codes across India through our logistics partners. Enter your pin code on the product page to confirm serviceability and estimated delivery time before ordering.',
      },
      {
        q: 'How long does delivery take?',
        a: 'Standard delivery takes 3–7 business days depending on your location. Metro cities (Chennai, Bengaluru, Mumbai, Delhi, Hyderabad) typically receive orders within 2–4 days. Express delivery (1–2 days) is available for select pin codes.',
      },
      {
        q: 'How do I track my order?',
        a: 'You\'ll receive an SMS and email with the tracking link once your order is dispatched. You can also track it anytime from your account under My Orders, or use our Track Order page with your order ID.',
      },
      {
        q: 'Is there a minimum order value for free shipping?',
        a: 'Shipping charges are calculated at checkout based on the product weight and your delivery pin code. Live rates from our logistics partner are shown before you complete payment.',
      },
    ],
  },
  {
    category: 'Returns & Warranty',
    items: [
      {
        q: 'What is your return policy?',
        a: 'We offer a 7-day return window for products that are unused, in original packaging, and accompanied by all accessories and the original invoice. Initiate a return from your order details page or contact our support team.',
      },
      {
        q: 'What if I receive a damaged or wrong product?',
        a: 'If your product arrives damaged or is incorrect, contact us within 48 hours of delivery with photos of the issue. We\'ll arrange a pickup and send a replacement or issue a full refund — no questions asked.',
      },
      {
        q: 'How do warranty claims work?',
        a: 'Warranty coverage varies by product and brand. You can check warranty terms on the product page. To make a claim, use our Warranty Check tool with your order ID and product serial number. Our support team will guide you through the vendor\'s service process.',
      },
    ],
  },
  {
    category: 'Products & Authenticity',
    items: [
      {
        q: 'Are all products on Macgly genuine?',
        a: 'Yes. We onboard vendors only after verifying their authorisation to sell the brands they list. Products go through quality checks before being approved for listing. If you ever receive a product you suspect is counterfeit, contact us immediately for a full investigation and refund.',
      },
      {
        q: 'Can I request a product that\'s not listed?',
        a: 'Yes. Use the Contact page to share the product name, brand, and specifications. Our sourcing team will check with our vendor network and reach out if we can fulfil your requirement.',
      },
    ],
  },
  {
    category: 'Selling on Macgly',
    items: [
      {
        q: 'How do I become a vendor?',
        a: 'Click "Sell on Macgly" in the navigation or footer. Fill in your business details, complete KYC verification, and your store will be live once approved. Our vendor onboarding team typically reviews applications within 2–3 business days.',
      },
      {
        q: 'What commission does Macgly charge vendors?',
        a: 'Commission varies by category, typically between 5–15% per sale. Full commission details are disclosed during vendor registration. There are no monthly listing fees — you pay only when you sell.',
      },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-secondary-100 last:border-0">
      <button
        className="flex items-start justify-between w-full py-4 text-left gap-4"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-medium text-secondary-900 text-sm leading-snug">{q}</span>
        <span className="shrink-0 mt-0.5 text-secondary-400">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm text-secondary-600 leading-relaxed -mt-1">{a}</p>
      )}
    </div>
  );
}

export default function Faq() {
  useEffect(() => {
    setMeta({
      title: 'Frequently Asked Questions | Macgly',
      description: 'Answers to common questions about ordering, payments, GST invoices, shipping, returns, warranties, and selling on Macgly.',
      canonical: 'https://www.macgly.com/info/faq',
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
      <p className="text-secondary-500 mb-8 text-sm">
        Can't find what you're looking for?{' '}
        <Link to="/info/contact" className="text-primary-600 hover:underline font-medium">Contact our support team</Link>.
      </p>

      <div className="space-y-8">
        {FAQS.map(({ category, items }) => (
          <div key={category}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-2 pb-2 border-b border-secondary-100">
              {category}
            </h2>
            <div className="card divide-y divide-secondary-100 overflow-hidden">
              {items.map((item) => (
                <div key={item.q} className="px-4">
                  <FaqItem q={item.q} a={item.a} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-primary-50 border border-primary-100 rounded-xl p-5 text-center space-y-3">
        <p className="font-semibold text-secondary-800">Still have questions?</p>
        <p className="text-sm text-secondary-500">Our team is available Mon–Sat, 9 AM – 6 PM IST.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/info/contact" className="btn-primary text-sm">Contact Us</Link>
          <a
            href="https://wa.me/919944556683?text=Hi%2C+I+have+a+question+about+Macgly."
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-sm border border-secondary-300 text-secondary-700 hover:bg-secondary-50"
          >
            WhatsApp Us
          </a>
        </div>
      </div>
    </div>
  );
}
