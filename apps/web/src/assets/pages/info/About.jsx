import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BadgeIndianRupee, Truck, Headphones, RotateCcw, Tags, FileText } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

export default function About() {
  useEffect(() => {
    setMeta({
      title: 'About Macgly — Tools & Machinery at Lower Prices',
      description: 'Macgly sells power tools, machinery and spare parts from established brands at lower prices, with free delivery across India and a GST invoice on every order.',
      canonical: 'https://www.macgly.com/info/about',
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold mb-3">About Macgly</h1>
        <p className="text-secondary-600 leading-relaxed">
          Macgly is an online store for power tools, machinery and spare parts. We sell products made by
          established tool and machinery brands — at lower prices than you would usually pay, with free
          delivery anywhere in India.
        </p>
      </div>

      {/* What we do */}
      <div className="border-l-4 border-primary-500 pl-5 space-y-3">
        <h2 className="text-xl font-bold">What We Do</h2>
        <p className="text-secondary-600 text-sm leading-relaxed">
          We don&apos;t manufacture tools. We source them from the brands and distributors that make them,
          keep our costs low, and pass the savings on to you — so workshops, contractors, farmers and home
          users can buy the tools they need for less.
        </p>
        <p className="text-secondary-600 text-sm leading-relaxed">
          Every order comes with a GST invoice, free delivery and a 7-day return window, and our team is a
          WhatsApp message away if you need help choosing the right tool.
        </p>
      </div>

      {/* Mission */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-6">
        <h2 className="text-xl font-bold text-primary-800 mb-2">Our Mission</h2>
        <p className="text-primary-700 text-sm leading-relaxed">
          To make good tools and machinery affordable for every workshop, contractor and home in India —
          at lower prices, with free delivery and a GST invoice on every order.
        </p>
      </div>

      {/* Why Macgly */}
      <div>
        <h2 className="text-xl font-bold mb-4">Why Buy From Macgly?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: BadgeIndianRupee, title: 'Lower Prices', desc: 'Branded tools and machinery for less than typical retail prices.' },
            { icon: Truck, title: 'Free Delivery', desc: 'Free delivery on every order, with no minimum order value. Check delivery to your pin code on any product page.' },
            { icon: Tags, title: 'Branded Products', desc: 'Each listing names the brand that makes the product, so you know exactly what you are buying.' },
            { icon: FileText, title: 'GST Invoice on Every Order', desc: 'A tax invoice is generated for every purchase — ready to download and use for ITC claims.' },
            { icon: RotateCcw, title: '7-Day Returns', desc: 'Unused products in original packaging can be returned within 7 days of delivery.' },
            { icon: Headphones, title: 'Help Choosing', desc: 'Not sure which tool fits the job? Ask us on WhatsApp, by email, or through the Contact page.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-4 flex gap-4">
              <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-secondary-900 text-sm">{title}</p>
                <p className="text-xs text-secondary-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-5 text-sm text-secondary-600">
        <p className="font-semibold text-secondary-800 mb-1">Our Office</p>
        <p>9/83, E, 4th Street, T.Balan Nagar, Ganapathipudur, Coimbatore – 641006, Tamil Nadu, India.</p>
        <p className="mt-1">
          <a href="tel:+919944556683" className="text-primary-600 hover:underline font-medium">+91 99445 56683</a>
          {' · '}
          <a href="mailto:macglyshop@gmail.com" className="text-primary-600 hover:underline font-medium">macglyshop@gmail.com</a>
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-wrap gap-3">
        <Link to="/products" className="btn-primary">Browse Products</Link>
        <Link to="/sell" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">Sell on Macgly</Link>
        <Link to="/info/contact" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">Contact Us</Link>
        <Link to="/info/faq" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">FAQs</Link>
      </div>
    </div>
  );
}
