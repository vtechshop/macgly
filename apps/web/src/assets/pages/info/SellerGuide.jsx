import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, FileText, Tag, Package, Banknote, TrendingUp, CheckCircle } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

const STEPS = [
  {
    icon: UserCheck,
    title: 'Register as a vendor',
    desc: 'Click "Sell on Macgly" and fill in your business details — company name, GST number, and contact information. Registration is free and takes under 5 minutes.',
    tips: [
      'Have your GSTIN, PAN, and business address ready',
      'Use a business email address for faster verification',
      'A valid bank account in the company name is required for settlements',
    ],
  },
  {
    icon: FileText,
    title: 'Complete KYC verification',
    desc: 'Upload your GST certificate, PAN card, and a cancelled cheque or bank statement. Our team reviews KYC documents within 2–3 business days. You\'ll receive an email confirmation once approved.',
    tips: [
      'Documents must be clear scans — blurry photos may delay approval',
      'GST registration is mandatory for all vendors on Macgly',
      'Contact support if your review takes longer than 3 business days',
    ],
  },
  {
    icon: Tag,
    title: 'List your products',
    desc: 'From your vendor dashboard, add products with titles, descriptions, images, specifications, and pricing. Our catalogue team reviews each listing before it goes live, typically within 24 hours.',
    tips: [
      'Use clear, white-background images — listings with 3+ images perform significantly better',
      'Include the brand, model number, and key specs in the title',
      'Set a compare-at price to show the customer\'s savings',
      'Add a GST rate so invoices are generated accurately',
    ],
  },
  {
    icon: Package,
    title: 'Manage and fulfil orders',
    desc: 'When a customer places an order, you\'ll receive an email and dashboard notification. Accept the order, pack it securely, and hand it over to the logistics partner within the handling time (typically 1–2 business days).',
    tips: [
      'Pack fragile tools with extra cushioning to prevent transit damage',
      'Update the tracking number in your dashboard immediately after dispatch',
      'Respond to customer inquiries within 24 hours to maintain your seller rating',
    ],
  },
  {
    icon: Banknote,
    title: 'Get paid',
    desc: 'Settlements are processed 7 days after confirmed delivery (T+7), net of Macgly\'s commission. Payments are transferred directly to your registered bank account. Commission varies by category (typically 5–15%).',
    tips: [
      'View your pending and completed settlements in the Settlements tab',
      'Commission invoices are available to download monthly for your accounting',
      'Disputes or return deductions are shown transparently before each settlement',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Grow your store',
    desc: 'Use the Ads Manager in your dashboard to boost product visibility. Monitor your sales analytics, review ratings, and inventory levels. Vendors with 4.5★+ ratings and fast dispatch times appear higher in search results.',
    tips: [
      'Respond to customer reviews — it shows you care and improves trust',
      'Keep inventory counts accurate to avoid cancellations, which hurt your ranking',
      'Contact our vendor support team for help with promotions and bulk deals',
    ],
  },
];

const PERKS = [
  { value: '0', label: 'Monthly listing fee', sub: 'Pay only when you sell' },
  { value: '5–15%', label: 'Commission per sale', sub: 'Transparent, no hidden charges' },
  { value: 'T+7', label: 'Settlement cycle', sub: 'Weekly payouts, direct to bank' },
  { value: '20k+', label: 'Pin codes served', sub: 'Reach buyers across all of India' },
];

export default function SellerGuide() {
  useEffect(() => {
    setMeta({
      title: 'Seller\'s Guide — Sell Tools & Machinery on Macgly',
      description: 'How to register as a vendor, list products, fulfil orders, and grow your business on Macgly — India\'s marketplace for tools and machinery.',
      canonical: 'https://www.macgly.com/info/seller-guide',
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Seller's Guide</h1>
      <p className="text-secondary-500 mb-6 text-sm leading-relaxed">
        Macgly connects verified vendors with buyers across India. Here's how to get started, list your products, and grow your business on our platform.
      </p>

      {/* Perks strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {PERKS.map(({ value, label, sub }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-xl font-black text-primary-600">{value}</p>
            <p className="text-xs font-semibold text-secondary-800 mt-0.5">{label}</p>
            <p className="text-[11px] text-secondary-400 mt-0.5 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-8 mb-10">
        {STEPS.map(({ icon: Icon, title, desc, tips }, i) => (
          <div key={title} className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-secondary-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Icon size={18} />
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px flex-1 bg-secondary-200 mt-3" />
              )}
            </div>
            <div className="pb-8 flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-secondary-400 mb-0.5">Step {i + 1}</p>
              <h2 className="text-lg font-bold text-secondary-900 mb-2">{title}</h2>
              <p className="text-sm text-secondary-600 leading-relaxed mb-3">{desc}</p>
              <ul className="space-y-1.5">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-secondary-500">
                    <CheckCircle size={12} className="text-secondary-400 shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-primary-50 border border-primary-100 rounded-xl p-6 text-center space-y-3">
        <h2 className="font-bold text-secondary-900">Ready to start selling?</h2>
        <p className="text-sm text-secondary-500">
          Join hundreds of verified vendors already growing their business on Macgly.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/sell" className="btn-primary">Register as Vendor</Link>
          <Link to="/info/contact" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">Talk to Our Team</Link>
        </div>
      </div>
    </div>
  );
}
