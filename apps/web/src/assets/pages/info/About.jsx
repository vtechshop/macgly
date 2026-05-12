import { Link } from 'react-router-dom';
import { Shield, Truck, Headphones, RotateCcw, Store, UserCheck } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold mb-3">About Macgly</h1>
        <p className="text-secondary-600 leading-relaxed">
          Macgly is India's dedicated marketplace for professional tools, machinery, and spare parts. We connect engineers, contractors, workshops, and factories with trusted vendors supplying genuine industrial and power tools — all in one place.
        </p>
      </div>

      {/* Mission */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-6">
        <h2 className="text-xl font-bold text-primary-800 mb-2">Our Mission</h2>
        <p className="text-primary-700 text-sm leading-relaxed">
          To make high-quality professional tools and machinery accessible and affordable for every workshop, contractor, and manufacturer in India — with fast delivery, expert support, and guaranteed authenticity.
        </p>
      </div>

      {/* Why Macgly */}
      <div>
        <h2 className="text-xl font-bold mb-4">Why Choose Macgly?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Shield, title: '100% Genuine Products', desc: 'Every product is verified for authenticity. We work only with authorised vendors and distributors.' },
            { icon: Truck, title: 'Pan India Delivery', desc: 'We ship to 20,000+ pin codes across India with reliable logistics partners.' },
            { icon: Headphones, title: 'Expert Technical Support', desc: 'Our team of technical experts is available to help you choose the right tool for the job.' },
            { icon: RotateCcw, title: '7-Day Easy Returns', desc: 'Not satisfied? Return unused products within 7 days for a full refund, no questions asked.' },
            { icon: Store, title: 'Multi-Vendor Platform', desc: 'Shop from hundreds of verified vendors and distributors, all in one trusted marketplace.' },
            { icon: UserCheck, title: 'Affiliate Program', desc: 'Earn commission by referring customers. Our affiliate program rewards you for every successful sale.' },
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
          { value: '50,000+', label: 'Happy Customers' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-black text-primary-600">{s.value}</p>
            <p className="text-xs text-secondary-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center space-y-3">
        <p className="text-secondary-600 text-sm">Have a question or want to become a vendor?</p>
        <div className="flex gap-3 justify-center">
          <Link to="/info/contact" className="btn-primary">Contact Us</Link>
          <Link to="/products" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50">Browse Products</Link>
        </div>
      </div>
    </div>
  );
}
