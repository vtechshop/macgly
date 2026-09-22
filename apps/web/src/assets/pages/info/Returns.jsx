import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Phone } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

export default function Returns() {
  useEffect(() => {
    setMeta({
      title:       'Returns & Refund Policy | Macgly',
      description: 'Hassle-free returns at Macgly. Learn about our return window, eligibility criteria, the return process, and how refunds are processed.',
      canonical:   'https://www.macgly.com/info/returns',
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-secondary-400 mb-6 flex items-center gap-1.5">
        <Link to="/" className="hover:text-secondary-700">Home</Link>
        <span>/</span>
        <span className="text-secondary-700 font-medium">Returns & Refund Policy</span>
      </nav>

      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Returns &amp; Refund Policy</h1>
      <p className="text-secondary-500 mb-8">
        {/* PLACEHOLDER: Verify the return window with your legal/business team.
            The FAQ page currently says 7 days; the API enforces 30 days.
            Set a single consistent value here before launch. */}
        Last updated: September 2024. We want you to be completely satisfied with your purchase.
      </p>

      {/* Key facts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        {[
          { icon: Clock, label: 'Return window', value: '[PLACEHOLDER: X days]' },
          { icon: RefreshCw, label: 'Refund method', value: 'Original payment method' },
          { icon: CheckCircle, label: 'Condition', value: 'Unused, original packaging' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-secondary-50 border border-secondary-200 rounded-xl p-4 text-center">
            <Icon size={22} className="text-primary-600 mx-auto mb-2" />
            <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-secondary-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Return Eligibility</h2>
          <p className="text-secondary-600 leading-relaxed mb-4">
            To be eligible for a return, items must meet the following conditions:
          </p>
          <ul className="space-y-2">
            {[
              'Returned within [PLACEHOLDER: X days] of delivery',
              'Item is unused, undamaged, and in its original condition',
              'Original packaging, all accessories, manuals, and tags are intact',
              'A GST invoice or order confirmation is available as proof of purchase',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-secondary-600">
                <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Items Not Eligible for Return</h2>
          <ul className="space-y-2">
            {[
              'Items damaged due to misuse, improper installation, or normal wear and tear',
              'Products with missing serial numbers, tampered stickers, or altered packaging',
              '[PLACEHOLDER: Perishable items, consumables, or custom-ordered products]',
              'Items that have been installed, assembled, or modified after delivery',
              '[PLACEHOLDER: Any other non-returnable category specific to your catalog]',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-secondary-600">
                <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">How to Initiate a Return</h2>
          <ol className="space-y-4">
            {[
              {
                step: '1',
                title: 'Log in to your account',
                desc: 'Go to My Orders in your customer dashboard and find the order you want to return.',
              },
              {
                step: '2',
                title: 'Select the item and reason',
                desc: 'Choose the specific item, select a return reason (defective, wrong item, not as described, etc.), and upload photos if the item is damaged.',
              },
              {
                step: '3',
                title: 'Schedule a pickup',
                desc: 'Once your return request is approved, a pickup will be scheduled from your delivery address. [PLACEHOLDER: Add estimated pickup timeframe — e.g., "within 2–3 business days".]',
              },
              {
                step: '4',
                title: 'Receive your refund',
                desc: 'After the returned item is inspected and approved, your refund will be processed to your original payment method. [PLACEHOLDER: Add refund timeframe — e.g., "within 5–7 business days".]',
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-secondary-800">{title}</p>
                  <p className="text-sm text-secondary-600 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Refund Process</h2>
          <p className="text-secondary-600 leading-relaxed">
            Refunds are processed to the original payment method used at checkout:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-secondary-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-secondary-100">
                  <th className="px-4 py-2.5 text-left font-semibold text-secondary-700 border-b border-secondary-200">Payment Method</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-secondary-700 border-b border-secondary-200">Refund Timeframe</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['UPI / Net Banking', '[PLACEHOLDER: X–Y business days]'],
                  ['Debit / Credit Card', '[PLACEHOLDER: X–Y business days]'],
                  ['Wallet / BNPL', '[PLACEHOLDER: X–Y business days]'],
                  ['Cash on Delivery (COD)', '[PLACEHOLDER: Refunded as store credit / bank transfer within X days]'],
                ].map(([method, time], i) => (
                  <tr key={method} className={i % 2 === 0 ? 'bg-white' : 'bg-secondary-50'}>
                    <td className="px-4 py-2.5 border-b border-secondary-100 text-secondary-700 font-medium">{method}</td>
                    <td className="px-4 py-2.5 border-b border-secondary-100 text-secondary-600">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Damaged or Defective Items</h2>
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-secondary-700">
              If you receive a damaged or defective item, do not use it.
              Take clear photographs of the damaged packaging and item, then contact us within{' '}
              <strong>[PLACEHOLDER: X days]</strong> of delivery. Damaged items are collected and
              replaced or fully refunded at no cost to you.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Vendor Returns</h2>
          <p className="text-secondary-600 leading-relaxed">
            Macgly is a marketplace. Some products are sold by third-party vendors. Return policies
            may vary slightly by vendor. The return window and eligibility criteria stated here apply
            to all products on the platform unless a product page states a more specific policy.
            [PLACEHOLDER: Review whether this paragraph applies to your business model or remove it.]
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Need Help?</h2>
          <p className="text-secondary-600 leading-relaxed mb-3">
            If you have any questions about your return or refund, reach out to our support team:
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href="https://wa.me/919944556683"
              className="flex items-center gap-2 text-primary-600 hover:underline font-medium"
            >
              <Phone size={15} /> WhatsApp: +91 99445 56683
            </a>
            <a href="mailto:macglyshop@gmail.com" className="text-primary-600 hover:underline font-medium">
              macglyshop@gmail.com
            </a>
          </div>
        </section>
      </div>

      {/* Related links */}
      <div className="mt-10 border-t border-secondary-200 pt-6 flex flex-wrap gap-4 text-sm">
        <Link to="/info/shipping" className="text-primary-600 hover:underline font-medium">Shipping Policy →</Link>
        <Link to="/info/faq" className="text-primary-600 hover:underline font-medium">FAQs →</Link>
        <Link to="/track-order" className="text-primary-600 hover:underline font-medium">Track Your Order →</Link>
        <Link to="/info/contact" className="text-primary-600 hover:underline font-medium">Contact Us →</Link>
      </div>
    </div>
  );
}
