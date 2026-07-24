import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Truck, Headphones, RotateCcw, Store, UserCheck } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

export default function About() {
  useEffect(() => {
    setMeta({
      title: 'About Macgly — India\'s Tools & Machinery Marketplace',
      description: 'Macgly is built in Coimbatore — India\'s manufacturing capital — to connect engineers, workshops and factories with genuine tools, machinery and spare parts.',
      canonical: 'https://www.macgly.com/info/about',
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold mb-3">About Macgly</h1>
        <p className="text-secondary-600 leading-relaxed">
          Macgly is India's dedicated marketplace for professional tools, machinery, and spare parts — built in Coimbatore, the heart of India's engineering and manufacturing belt, to serve workshops, contractors, and factories across the country.
        </p>
      </div>

      {/* Founding story */}
      <div className="border-l-4 border-primary-500 pl-5 space-y-3">
        <h2 className="text-xl font-bold">Why We Built Macgly</h2>
        <p className="text-secondary-600 text-sm leading-relaxed">
          Coimbatore has long been one of India's most productive industrial cities — a base for pump manufacturers, textile machinery makers, engineering workshops, and precision component suppliers. But for decades, buyers outside the city had to rely on fragmented local dealers, informal WhatsApp networks, or generic e-commerce platforms that mixed genuine tools with substandard alternatives.
        </p>
        <p className="text-secondary-600 text-sm leading-relaxed">
          We built Macgly to fix that. Our goal from day one was simple: a platform where buyers anywhere in India can find verified, professional-grade tools from authorised vendors — with proper invoices, real warranties, and support from people who actually understand the products.
        </p>
        <p className="text-secondary-600 text-sm leading-relaxed">
          Today, Macgly lists thousands of products across agricultural tools, engineering kits, power tools, spare parts, and general machinery — all sourced from vendors who go through our authorisation and KYC process before going live.
        </p>
      </div>

      {/* Mission */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-6">
        <h2 className="text-xl font-bold text-primary-800 mb-2">Our Mission</h2>
        <p className="text-primary-700 text-sm leading-relaxed">
          To make high-quality professional tools and machinery accessible for every workshop, contractor, and manufacturer in India — with fast delivery, expert support, genuine products, and GST invoices for every purchase.
        </p>
      </div>

      {/* Why Macgly */}
      <div>
        <h2 className="text-xl font-bold mb-4">Why Choose Macgly?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Shield, title: '100% Genuine Products', desc: 'Every vendor is verified and authorised. Products are reviewed before listing. If you ever receive a counterfeit, we make it right — full stop.' },
            { icon: Truck, title: 'Pan India Delivery', desc: 'We deliver to 20,000+ pin codes across India. Check serviceability on any product page before you order.' },
            { icon: Headphones, title: 'Technical Support', desc: 'Our team can help you choose the right tool for the job. Reach us on WhatsApp, email, or the Contact page.' },
            { icon: RotateCcw, title: '7-Day Easy Returns', desc: 'Unused products in original packaging can be returned within 7 days for a full refund. No complicated forms.' },
            { icon: Store, title: 'Multi-Vendor Marketplace', desc: 'Shop from hundreds of verified vendors and distributors in one place — with a single checkout and one invoice.' },
            { icon: UserCheck, title: 'GST Invoice on Every Order', desc: 'A tax-compliant invoice is generated automatically for every purchase — ready to download and use for ITC claims.' },
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { value: '10,000+', label: 'Products Listed' },
          { value: '500+', label: 'Verified Vendors' },
          { value: '20,000+', label: 'Pin Codes Served' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-black text-primary-600">{s.value}</p>
            <p className="text-xs text-secondary-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Location */}
      <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-5 text-sm text-secondary-600">
        <p className="font-semibold text-secondary-800 mb-1">Headquartered in Coimbatore</p>
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
