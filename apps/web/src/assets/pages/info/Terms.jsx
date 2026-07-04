import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'acceptance',
    num: '1.',
    title: 'Acceptance of Terms',
    content: (
      <>
        <p>By accessing and using Macgly's e-commerce platform, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
      </>
    ),
  },
  {
    id: 'account',
    num: '2.',
    title: 'User Accounts',
    subsections: [
      {
        num: '2.1',
        title: 'Eligibility',
        content: 'You must be at least 18 years old to use our services. By using our platform, you represent that you are of legal age to form a binding contract.',
      },
      {
        num: '2.2',
        title: 'Account Registration',
        bullets: [
          'You must provide accurate and complete information',
          'You are responsible for maintaining account security',
          'You must notify us immediately of any unauthorized access',
          'One person may not create multiple accounts',
        ],
      },
      {
        num: '2.3',
        title: 'Account Termination',
        content: 'Macgly reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform.',
      },
    ],
  },
  {
    id: 'products',
    num: '3.',
    title: 'Products and Services',
    subsections: [
      {
        num: '3.1',
        title: 'Product Information',
        content: 'We strive to display accurate product information. However, we do not warrant that product descriptions, pricing, or other content is accurate, complete, reliable, current, or error-free.',
      },
      {
        num: '3.2',
        title: 'Pricing',
        bullets: [
          'All prices are in Indian Rupees (INR) unless otherwise stated',
          'Prices are inclusive of applicable GST',
          'We reserve the right to change prices at any time without notice',
          'Prices at the time of order placement are honoured for confirmed orders',
        ],
      },
      {
        num: '3.3',
        title: 'Availability',
        content: 'Product availability is subject to change. We reserve the right to limit quantities or discontinue products at any time. In the event of a stock discrepancy after order placement, we will notify you and offer a full refund.',
      },
    ],
  },
  {
    id: 'orders',
    num: '4.',
    title: 'Orders and Payments',
    subsections: [
      {
        num: '4.1',
        title: 'Order Placement',
        content: 'By placing an order, you make an offer to purchase the selected products. We reserve the right to accept or decline any order at our discretion.',
      },
      {
        num: '4.2',
        title: 'Payment Methods',
        bullets: [
          'Online payment via Razorpay (UPI, debit/credit cards, net banking)',
          'Macgly does not store card or banking credentials',
          'All online transactions are secured with 256-bit SSL encryption',
        ],
      },
      {
        num: '4.3',
        title: 'Order Cancellation',
        bullets: [
          'Orders can be cancelled before shipment via "My Orders" in your dashboard',
          'Once shipped, cancellations are not accepted — please follow the return process instead',
          'Refunds for cancellations are processed immediately to the original payment method',
        ],
      },
    ],
  },
  {
    id: 'shipping',
    num: '5.',
    title: 'Shipping and Delivery',
    subsections: [
      {
        num: '5.1',
        title: 'Delivery Timelines',
        content: 'Standard delivery takes 3–7 business days. Express delivery takes 1–2 business days. Timelines are estimates and may vary based on location and availability.',
      },
      {
        num: '5.2',
        title: 'Shipping Charges',
        bullets: [
          'Shipping charges are calculated at checkout based on destination pincode and order weight',
          'Standard and Express delivery options are available at competitive rates',
          'Free shipping on orders above ₹5,000 (standard delivery)',
          'Remote area surcharges may apply as determined by our logistics partner',
        ],
      },
      {
        num: '5.3',
        title: 'Delivery Responsibility',
        content: 'Macgly is not responsible for delays caused by logistics partners, natural disasters, strikes, or other circumstances beyond our control. Risk of loss passes to you upon delivery.',
      },
    ],
  },
  {
    id: 'returns',
    num: '6.',
    title: 'Returns, Refunds & Exchange',
    subsections: [
      {
        num: '6.1',
        title: 'Return Policy',
        bullets: [
          'Items can be returned within 30 days of delivery',
          'Product must be unused, unwashed, and in original packaging with all tags, labels, and invoice intact',
          'Raise a return request via "My Orders" in your dashboard or by emailing ledvtech@gmail.com',
        ],
      },
      {
        num: '6.2',
        title: 'Non-Returnable Items',
        bullets: [
          'Products marked "Non-Returnable" on the listing',
          'Personal care, intimate, and hygiene products',
          'Customized / personalized items',
          'Perishable goods and gift cards',
          'Products with tampered or missing serial numbers',
          'Items damaged due to misuse or mishandling',
        ],
      },
      {
        num: '6.3',
        title: 'Return Process',
        bullets: [
          'Raise a return request within 30 days of delivery via "My Orders"',
          'Pack the item securely in original packaging',
          'Our delivery partner will do a free pickup from your address',
          'Item is inspected — if approved, refund is initiated',
        ],
      },
      {
        num: '6.4',
        title: 'Refund Timeline',
        content: (
          <div className="mt-2 overflow-x-auto">
            <table className="text-sm text-secondary-600 border-collapse w-full">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="text-left py-2 pr-8 font-semibold text-secondary-700">Payment Method</th>
                  <th className="text-left py-2 font-semibold text-secondary-700">Refund Time</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Credit / Debit Card', '5–7 business days'],
                  ['UPI / Net Banking',   '3–5 business days'],
                  ['Wallet',             '2–3 business days'],
                ].map(([method, time]) => (
                  <tr key={method} className="border-b border-secondary-100">
                    <td className="py-2 pr-8">{method}</td>
                    <td className="py-2">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
      {
        num: '6.5',
        title: 'Exchange',
        bullets: [
          'Exchange is available for a different size, colour, or variant of the same product',
          'Exchange requests are processed faster than refunds',
          'Contact us via "My Orders" or email to initiate an exchange',
        ],
      },
    ],
  },
  {
    id: 'vendors',
    num: '7.',
    title: 'Vendor Terms',
    subsections: [
      {
        num: '7.1',
        title: 'Vendor Responsibilities',
        bullets: [
          'Provide accurate product information and authentic products',
          'Maintain adequate stock and fulfil orders promptly',
          'Comply with all applicable laws and regulations',
          'Respond to support tickets within 48 hours',
        ],
      },
      {
        num: '7.2',
        title: 'Commission and Payouts',
        content: 'Macgly charges a platform commission on each sale. Payout rates vary by category and are communicated during onboarding. Payouts are processed weekly after order delivery confirmation.',
      },
    ],
  },
  {
    id: 'affiliate',
    num: '8.',
    title: 'Affiliate Program',
    content: (
      <>
        <p>Affiliates earn commission on qualifying purchases made through their referral links. Commission rates are set at the time of registration and may be revised with 30 days notice. Fraudulent referral activity will result in immediate account termination and forfeiture of all pending earnings.</p>
      </>
    ),
  },
  {
    id: 'ip',
    num: '9.',
    title: 'Intellectual Property',
    content: (
      <>
        <p>All content on Macgly — including logos, product images, text, and design elements — is the intellectual property of Macgly or its respective vendors and partners. You may not reproduce, distribute, or create derivative works without explicit written permission.</p>
      </>
    ),
  },
  {
    id: 'liability',
    num: '10.',
    title: 'Limitation of Liability',
    content: (
      <>
        <p>Macgly shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. Our maximum aggregate liability for any claim shall not exceed the value of the specific order in question.</p>
      </>
    ),
  },
  {
    id: 'changes',
    num: '11.',
    title: 'Changes to Terms',
    content: (
      <>
        <p>We reserve the right to modify these Terms of Service at any time. Changes will be notified via email or a prominent notice on the platform. Continued use of Macgly after changes constitutes your acceptance of the revised terms.</p>
      </>
    ),
  },
];

function SubSection({ sub }) {
  return (
    <div className="mt-5">
      <h3 className="text-base font-bold text-secondary-800 mb-2">{sub.num} {sub.title}</h3>
      {sub.content && <p className="text-secondary-600 leading-relaxed">{sub.content}</p>}
      {sub.bullets && (
        <ul className="mt-2 space-y-1.5 list-none">
          {sub.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-secondary-600">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-secondary-400 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Terms() {
  const tocItems = SECTIONS.map((s) => ({ id: s.id, num: s.num, title: s.title }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <div className="lg:grid lg:grid-cols-4 lg:gap-12">

        {/* Table of Contents — sticky sidebar on desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-1">
            <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest mb-3">Contents</p>
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex gap-2 items-start py-1 text-sm text-secondary-500 hover:text-primary-600 transition-colors leading-snug"
              >
                <span className="shrink-0 font-medium text-secondary-400">{item.num}</span>
                {item.title}
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="lg:col-span-3">
          <h1 className="text-4xl font-bold text-secondary-900 mb-1">Terms of Service</h1>
          <p className="text-secondary-400 text-sm mb-10">Last updated: May 2026</p>

          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-6">
                <h2 className="text-xl font-bold text-secondary-900 pb-2 border-b border-secondary-100 mb-3">
                  {section.num} {section.title}
                </h2>
                {section.content && (
                  <div className="text-secondary-600 leading-relaxed space-y-3">{section.content}</div>
                )}
                {section.subsections?.map((sub) => (
                  <SubSection key={sub.num} sub={sub} />
                ))}
              </section>
            ))}

            <div className="pt-6 border-t border-secondary-200 text-sm text-secondary-600">
              <p>
                Have questions about these terms?{' '}
                <Link to="/info/contact" className="text-primary-600 hover:underline font-medium">Contact our support team</Link>{' '}
                or email us at{' '}
                <a href="mailto:macglyshop@gmail.com" className="text-primary-600 hover:underline font-medium">macglyshop@gmail.com</a>
                {' '}/ <a href="mailto:ledvtech@gmail.com" className="text-primary-600 hover:underline font-medium">ledvtech@gmail.com</a>
                {' '}or call <a href="tel:+919944556683" className="text-primary-600 hover:underline font-medium">+91 99445 56683</a>.
              </p>
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
