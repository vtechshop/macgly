import { Link } from 'react-router-dom';
import { Wrench, Phone, Mail, MapPin, Facebook, Youtube, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-secondary-900 text-secondary-300 mt-auto">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-primary-600 text-white p-1.5 rounded">
                <Wrench size={16} />
              </div>
              <span className="text-white font-black text-lg tracking-tight">MACGLY</span>
            </Link>
            <p className="mt-3 text-sm text-secondary-400 leading-relaxed">
              India's trusted marketplace for professional tools, industrial machines and genuine spare parts.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Phone size={13} /><span>+91 98765 43210</span></div>
              <div className="flex items-center gap-2"><Mail size={13} /><span>support@macgly.com</span></div>
              <div className="flex items-center gap-2 text-secondary-500"><MapPin size={13} /><span>Chennai, Tamil Nadu, India</span></div>
            </div>
            <div className="flex gap-3 mt-4">
              <a href="#" className="text-secondary-500 hover:text-primary-400 transition-colors"><Facebook size={18} /></a>
              <a href="#" className="text-secondary-500 hover:text-primary-400 transition-colors"><Youtube size={18} /></a>
              <a href="#" className="text-secondary-500 hover:text-primary-400 transition-colors"><Instagram size={18} /></a>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products?category=power-tools" className="hover:text-primary-400 transition-colors">Power Tools</Link></li>
              <li><Link to="/products?category=hand-tools" className="hover:text-primary-400 transition-colors">Hand Tools</Link></li>
              <li><Link to="/products?category=spare-parts" className="hover:text-primary-400 transition-colors">Spare Parts</Link></li>
              <li><Link to="/products?category=machines" className="hover:text-primary-400 transition-colors">Machines</Link></li>
              <li><Link to="/products?category=safety" className="hover:text-primary-400 transition-colors">Safety Equipment</Link></li>
              <li><Link to="/products" className="hover:text-primary-400 transition-colors">All Products</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">My Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/login" className="hover:text-primary-400 transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-primary-400 transition-colors">Register</Link></li>
              <li><Link to="/dashboard/customer" className="hover:text-primary-400 transition-colors">My Orders</Link></li>
              <li><Link to="/cart" className="hover:text-primary-400 transition-colors">My Cart</Link></li>
              <li><Link to="/sell" className="hover:text-primary-400 transition-colors">Sell on Macgly</Link></li>
              <li><Link to="/affiliate" className="hover:text-primary-400 transition-colors">Affiliate Program</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">Help</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/info/about" className="hover:text-primary-400 transition-colors">About Us</Link></li>
              <li><Link to="/info/contact" className="hover:text-primary-400 transition-colors">Contact Us</Link></li>
              <li><Link to="/info/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/info/terms" className="hover:text-primary-400 transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-secondary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-secondary-500">
          <span>© {new Date().getFullYear()} Macgly. All rights reserved. GST: 33XXXXX0000X1ZX</span>
          <div className="flex items-center gap-3">
            <span>Secure Payments</span>
            <div className="flex gap-2">
              {['UPI', 'Visa', 'MC', 'RuPay'].map((m) => (
                <span key={m} className="border border-secondary-700 text-secondary-400 text-[10px] px-1.5 py-0.5 rounded">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
