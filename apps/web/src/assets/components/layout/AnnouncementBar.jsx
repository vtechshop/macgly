import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';

// Site-wide strip above the header. It scrolls away with the page so the
// sticky header keeps its height; delivery is free on every order (see the
// shipping-rates route), so there is no minimum to mention.
export default function AnnouncementBar() {
  return (
    <Link
      to="/info/shipping"
      className="block text-white text-center text-xs sm:text-sm px-4 py-2 hover:brightness-110 transition"
      style={{ background: 'linear-gradient(90deg, #3B1F0A 0%, #7c2d12 50%, #3B1F0A 100%)' }}
    >
      <span className="inline-flex items-center justify-center gap-2 flex-wrap">
        <Truck size={16} className="shrink-0" style={{ color: '#fb923c' }} aria-hidden="true" />
        <span>
          <strong className="font-extrabold tracking-wide" style={{ color: '#fb923c' }}>FREE DELIVERY</strong>
          {' '}on every order
        </span>
        <span className="hidden sm:inline text-white/80">· No minimum order · Anywhere in India</span>
      </span>
    </Link>
  );
}
