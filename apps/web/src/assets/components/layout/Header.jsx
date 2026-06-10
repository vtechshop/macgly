import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ShoppingCart, Search, Menu, X, ChevronDown, User, Heart } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { clearUser } from '../../../store/slices/authSlice';
import { clearCart, openCartDrawer } from '../../../store/slices/cartSlice';
import api from '../../../utils/api';
import { normalizeImageUrl } from '../../../utils/format';
import { useFetch } from '../../../hooks';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { label: 'Home',            to: '/' },
  { label: 'Products',        to: '/products' },
  { label: 'Categories',      to: '/categories' },
  { label: 'Contact Us',      to: '/info/contact' },
  { label: 'Blog',            to: '/blog' },
  { label: 'About',           to: '/info/about' },
  { label: 'Track Order',     to: '/track-order' },
  { label: 'Warranty Check',  to: '/warranty-check' },
];

export default function Header() {
  const { user } = useSelector((s) => s.auth);
  const { count } = useSelector((s) => s.cart);
  const { data: wishlistData } = useFetch(
    user ? ['wishlist-ids', user._id] : null,
    () => api.get('/users/wishlist/ids').then((r) => r.data)
  );
  const wishlistCount = wishlistData?.ids?.length || 0;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) { if (!accountRef.current?.contains(e.target)) setAccountOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/catalog/products', { params: { search: q, limit: 6 } });
        setSuggestions(data.products || []);
      } catch { setSuggestions([]); }
    }, 300);
  }, []);

  useEffect(() => {
    function handleClick(e) { if (!searchRef.current?.contains(e.target)) setShowSuggestions(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
      dispatch(clearUser());
      dispatch(clearCart());
      navigate('/');
    } catch {
      toast.error('Logout failed');
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <header className="sticky top-0 z-50">

      {/* ── Main bar ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-secondary-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-5 h-[88px]">

            {/* Logo */}
            <Link to="/" className="shrink-0 flex items-center gap-2.5 select-none">
              {/* Hexagon M icon */}
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 2L34.5 11V27L19 36L3.5 27V11L19 2Z" fill="#3B1F0A"/>
                <path d="M19 2L34.5 11V27L19 36L3.5 27V11L19 2Z" stroke="#3B1F0A" strokeWidth="1"/>
                <text x="19" y="24" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="Arial Black, sans-serif">M</text>
                <path d="M24 26L31 22" stroke="#F97316" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              {/* Brand text */}
              <div className="flex flex-col leading-none">
                <span className="font-black tracking-wider text-xl">
                  <span style={{ color: '#3B1F0A' }}>MAC</span><span className="text-orange-500">GLY</span>
                </span>
                <span className="text-[9px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#7B4F2E' }}>Tools &amp; Machinery</span>
              </div>
            </Link>

            {/* Search — desktop */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-auto" ref={searchRef}>
              <div className="flex w-full relative">
                <input
                  className="flex-1 h-11 px-4 text-sm bg-white text-secondary-900 placeholder-secondary-400 border-0 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="What are you looking for?"
                  value={searchQuery}
                  autoComplete="off"
                  onChange={(e) => { setSearchQuery(e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => suggestions.length && setShowSuggestions(true)}
                />
                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white h-11 px-5 rounded-r-lg flex items-center justify-center transition-colors shrink-0">
                  <Search size={18} />
                </button>

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-secondary-200 rounded-b-xl shadow-2xl z-50 overflow-hidden mt-0.5">
                    {suggestions.map((p) => (
                      <Link key={p._id} to={`/product/${p.slug}`}
                        onClick={() => { setShowSuggestions(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary-50 transition-colors">
                        {p.images?.[0] && <img src={normalizeImageUrl(p.images[0])} alt="" className="w-8 h-8 rounded object-contain bg-secondary-100" onError={(e) => e.target.style.display = 'none'} />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                          <p className="text-xs text-secondary-400">{p.brand}</p>
                        </div>
                        <p className="text-sm font-bold text-primary-700 shrink-0">₹{p.price}</p>
                      </Link>
                    ))}
                    <Link to={`/products?search=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setShowSuggestions(false)}
                      className="block px-4 py-2.5 text-xs text-center text-primary-600 font-semibold hover:bg-primary-50 border-t border-secondary-100">
                      See all results for "{searchQuery}"
                    </Link>
                  </div>
                )}
              </div>
            </form>

            {/* Right actions */}
            <div className="flex items-center gap-1 ml-auto md:ml-0 shrink-0">

              {/* Account */}
              <div className="relative hidden md:block" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 text-secondary-700 hover:text-primary-600 transition-colors px-3 py-2 rounded-lg hover:bg-secondary-100"
                >
                  <User size={20} />
                  <div className="flex flex-col items-start leading-none">
                    {user
                      ? <><span className="text-[10px] text-secondary-500">Hello, {user.name.split(' ')[0]}</span><span className="text-xs font-semibold flex items-center gap-0.5">My Account <ChevronDown size={11} /></span></>
                      : <><span className="text-[10px] text-secondary-500">Welcome</span><span className="text-xs font-semibold flex items-center gap-0.5">LOGIN <ChevronDown size={11} /></span></>
                    }
                  </div>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-secondary-200 shadow-xl z-50 py-1 overflow-hidden">
                    {user ? (
                      <>
                        <Link to={`/dashboard/${user.role}`} onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-secondary-700 hover:bg-secondary-50">Dashboard</Link>
                        <Link to="/dashboard/customer/orders" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-secondary-700 hover:bg-secondary-50">My Orders</Link>
                        <button onClick={() => { setAccountOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-secondary-100">Logout</button>
                      </>
                    ) : (
                      <>
                        <Link to="/login" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-secondary-800 hover:bg-secondary-50">Sign In</Link>
                        <Link to="/register" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-secondary-700 hover:bg-secondary-50">Register</Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Wishlist */}
              <Link
                to="/dashboard/customer/wishlist"
                className="relative hidden md:flex items-center gap-2 text-secondary-700 hover:text-primary-600 transition-colors px-3 py-2 rounded-lg hover:bg-secondary-100"
              >
                <div className="relative">
                  <Heart size={22} />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{wishlistCount}</span>
                  )}
                </div>
              </Link>

              {/* Cart */}
              <button
                onClick={() => dispatch(openCartDrawer())}
                className="relative flex items-center gap-2 text-secondary-700 hover:text-primary-600 transition-colors px-3 py-2 rounded-lg hover:bg-secondary-100"
              >
                <div className="relative">
                  <ShoppingCart size={22} />
                  {count > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold hidden md:block text-secondary-700">Cart</span>
              </button>

              {/* Mobile search icon */}
              <button className="md:hidden p-2 text-secondary-700 hover:text-primary-600 transition-colors"
                onClick={() => { setMenuOpen(true); setTimeout(() => document.getElementById('mobile-search')?.focus(), 100); }}>
                <Search size={20} />
              </button>

              {/* Mobile hamburger */}
              <button className="md:hidden p-2 text-secondary-700" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav bar ──────────────────────────────────────────── */}
      <div className="bg-secondary-900 hidden md:block border-b border-secondary-800">
        <div className="px-4 sm:px-6 lg:px-10">
          <div className="flex items-center">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[11px] font-semibold tracking-wide px-4 py-2.5 whitespace-nowrap transition-colors text-secondary-400 hover:text-white hover:bg-secondary-800"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile menu ──────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-secondary-200">
          <div className="px-4 py-4 space-y-4">
            <form onSubmit={handleSearch}>
              <div className="flex">
                <input
                  id="mobile-search"
                  className="flex-1 h-10 px-4 text-sm bg-secondary-50 text-secondary-900 placeholder-secondary-400 rounded-l-lg border border-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="bg-primary-600 text-white h-10 px-4 rounded-r-lg">
                  <Search size={16} />
                </button>
              </div>
            </form>
            <div className="grid grid-cols-2 gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
                  className="text-sm text-secondary-600 hover:text-primary-600 py-2 px-1 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
            {!user && (
              <div className="flex gap-2 pt-2 border-t border-secondary-200">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary flex-1 text-center text-xs">Sign In</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-outline flex-1 text-center text-xs border-white/20 text-white hover:bg-white/10">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
