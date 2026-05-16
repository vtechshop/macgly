import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ShoppingCart, Search, Menu, X, Phone, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { clearUser } from '../../../store/slices/authSlice';
import { clearCart, openCartDrawer } from '../../../store/slices/cartSlice';
import api from '../../../utils/api';
import { normalizeImageUrl } from '../../../utils/format';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { label: 'All Products', to: '/products' },
  { label: 'Power Tools', to: '/products?category=power-tools' },
  { label: 'Hand Tools', to: '/products?category=hand-tools' },
  { label: 'Spare Parts', to: '/products?category=spare-parts' },
  { label: 'Machines', to: '/products?category=machines' },
  { label: 'Safety Equipment', to: '/products?category=safety' },
];

export default function Header() {
  const { user } = useSelector((s) => s.auth);
  const { count } = useSelector((s) => s.cart);
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
      {/* Top bar */}
      <div className="bg-secondary-900 text-secondary-300 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-8">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone size={11} /> +91 98765 43210</span>
            <span className="hidden sm:block">Mon–Sat 9AM–6PM</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block">Free shipping on orders above ₹999</span>
            <Link to="/sell" className="hover:text-white transition-colors">Sell on Macgly</Link>
            <Link to="/affiliate" className="hover:text-white transition-colors">Affiliate Program</Link>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-white border-b border-secondary-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-2">
            {/* Logo */}
            <Link to="/" className="shrink-0">
              <img src="/logo.png" alt="Macgly Tools & Machinery" className="h-28 w-auto" />
            </Link>

            {/* Search */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-4" ref={searchRef}>
              <div className="flex w-full relative">
                <input
                  className="input rounded-r-none flex-1 border-r-0"
                  placeholder="Search for tools, machines, spare parts..."
                  value={searchQuery}
                  autoComplete="off"
                  onChange={(e) => { setSearchQuery(e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => suggestions.length && setShowSuggestions(true)}
                />
                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-5 rounded-r font-medium text-sm flex items-center transition-colors">
                  <Search size={16} />
                </button>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-secondary-200 rounded-b-lg shadow-xl z-50 overflow-hidden">
                    {suggestions.map((p) => (
                      <Link key={p._id} to={`/product/${p.slug}`}
                        onClick={() => { setShowSuggestions(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary-50 transition-colors">
                        {p.images?.[0] && <img src={normalizeImageUrl(p.images[0])} alt="" className="w-8 h-8 rounded object-contain bg-secondary-100" onError={(e) => e.target.style.display='none'} />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                          <p className="text-xs text-secondary-400">{p.brand}</p>
                        </div>
                        <p className="text-sm font-bold text-primary-700 shrink-0">₹{p.price}</p>
                      </Link>
                    ))}
                    <Link to={`/products?search=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setShowSuggestions(false)}
                      className="block px-4 py-2 text-xs text-center text-primary-600 font-semibold hover:bg-primary-50 border-t border-secondary-100">
                      See all results for "{searchQuery}"
                    </Link>
                  </div>
                )}
              </div>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto md:ml-0">
              {user ? (
                <div className="relative hidden md:block" ref={accountRef}>
                  <button onClick={() => setAccountOpen((v) => !v)} className="flex flex-col items-start text-secondary-700 hover:text-primary-600 transition-colors">
                    <span className="text-[10px] text-secondary-400">Hello, {user.name.split(' ')[0]}</span>
                    <span className="text-xs font-semibold flex items-center gap-1">My Account <ChevronDown size={12} /></span>
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 card py-1 shadow-lg z-50">
                      <Link to={`/dashboard/${user.role}`} onClick={() => setAccountOpen(false)} className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50">
                        Dashboard
                      </Link>
                      <Link to="/dashboard/customer/orders" onClick={() => setAccountOpen(false)} className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50">
                        My Orders
                      </Link>
                      <button onClick={() => { setAccountOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-[10px] text-secondary-400">Welcome</span>
                  <Link to="/login" className="text-xs font-semibold text-secondary-700 hover:text-primary-600 flex items-center gap-1">
                    Sign In / Register <ChevronDown size={12} />
                  </Link>
                </div>
              )}

              <button onClick={() => dispatch(openCartDrawer())} className="relative flex flex-col items-center text-secondary-700 hover:text-primary-600 transition-colors px-2">
                <div className="relative">
                  <ShoppingCart size={22} />
                  {count > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold hidden md:block">Cart</span>
              </button>

              <button className="md:hidden p-2 text-secondary-700" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Category nav bar */}
      <div className="bg-secondary-800 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs font-medium text-secondary-200 hover:text-primary-400 hover:bg-secondary-700 px-3 py-2.5 transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
            <Link to="/products?featured=true" className="ml-auto text-xs font-bold text-primary-400 hover:text-primary-300 px-3 py-2.5 flex items-center gap-1">
              🔥 Deals
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-secondary-200 shadow-lg">
          <div className="px-4 py-3 space-y-3">
            <form onSubmit={handleSearch}>
              <div className="flex">
                <input
                  className="input rounded-r-none flex-1 border-r-0"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="bg-primary-600 text-white px-4 rounded-r">
                  <Search size={16} />
                </button>
              </div>
            </form>
            <div className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
                  className="text-sm text-secondary-700 hover:text-primary-600 py-1">
                  {link.label}
                </Link>
              ))}
            </div>
            {!user && (
              <div className="flex gap-2 pt-2 border-t border-secondary-100">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary flex-1 text-center text-xs">Sign In</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-outline flex-1 text-center text-xs">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
