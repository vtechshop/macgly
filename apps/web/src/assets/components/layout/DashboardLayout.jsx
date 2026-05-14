import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, Users,
  Tag, Image, Settings, LogOut, Ticket, MapPin, Heart,
  Store, UserCheck, IndianRupee, Link2, ShieldCheck, HelpCircle, Clock, CreditCard, Star, Menu, X,
  FileText, Inbox, Sliders, LayoutTemplate, ClipboardList, BookOpen, Share2, Mail, Warehouse,
  RotateCcw, Megaphone, Zap, BarChart2, PenTool,
} from 'lucide-react';
import VendorOnboarding from '../../pages/dashboard/vendor/VendorOnboarding';
import api from '../../../utils/api';
import { clearUser } from '../../../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const navsByRole = {
  admin: [
    { type: 'item', to: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { type: 'section', label: 'Orders' },
    { type: 'item', to: '/dashboard/admin/orders', label: 'All Orders', icon: ShoppingBag },
    { type: 'section', label: 'Catalog' },
    { type: 'item', to: '/dashboard/admin/products', label: 'Products', icon: Package },
    { type: 'item', to: '/dashboard/admin/categories', label: 'Categories', icon: Tag },
    { type: 'item', to: '/dashboard/admin/banners', label: 'Banners', icon: Image },
    { type: 'section', label: 'Marketing' },
    { type: 'item', to: '/dashboard/admin/coupons', label: 'Coupons', icon: Ticket },
    { type: 'item', to: '/dashboard/admin/flash-sales', label: 'Flash Sales', icon: Zap },
    { type: 'item', to: '/dashboard/admin/ads', label: 'Ad Campaigns', icon: Megaphone },
    { type: 'item', to: '/dashboard/admin/newsletter', label: 'Newsletter', icon: Mail },
    { type: 'section', label: 'People' },
    { type: 'item', to: '/dashboard/admin/users', label: 'Users', icon: Users },
    { type: 'item', to: '/dashboard/admin/vendors', label: 'Vendors', icon: Store },
    { type: 'item', to: '/dashboard/admin/affiliates', label: 'Affiliates', icon: UserCheck },
    { type: 'section', label: 'Finance' },
    { type: 'item', to: '/dashboard/admin/payments', label: 'Payments', icon: CreditCard },
    { type: 'item', to: '/dashboard/admin/commissions', label: 'Commissions', icon: IndianRupee },
    { type: 'item', to: '/dashboard/admin/returns', label: 'Returns', icon: RotateCcw },
    { type: 'item', to: '/dashboard/admin/kyc', label: 'KYC Review', icon: ShieldCheck },
    { type: 'section', label: 'Quality' },
    { type: 'item', to: '/dashboard/admin/reviews', label: 'Reviews', icon: Star },
    { type: 'item', to: '/dashboard/admin/warranty', label: 'Warranty', icon: ShieldCheck },
    { type: 'section', label: 'Support' },
    { type: 'item', to: '/dashboard/admin/tickets', label: 'Support Tickets', icon: HelpCircle },
    { type: 'item', to: '/dashboard/admin/contact-submissions', label: 'Contact Messages', icon: Inbox },
    { type: 'section', label: 'Operations' },
    { type: 'item', to: '/dashboard/admin/inventory', label: 'Inventory', icon: Warehouse },
    { type: 'item', to: '/dashboard/admin/manual-orders', label: 'Manual Orders', icon: ClipboardList },
    { type: 'item', to: '/dashboard/admin/crm', label: 'CRM', icon: Users },
    { type: 'item', to: '/dashboard/admin/communications', label: 'Communications', icon: Mail },
    { type: 'item', to: '/dashboard/admin/share-catalog', label: 'Share Catalog', icon: Share2 },
    { type: 'section', label: 'Content' },
    { type: 'item', to: '/dashboard/admin/blog', label: 'Blog', icon: BookOpen },
    { type: 'item', to: '/dashboard/admin/cms', label: 'CMS Pages', icon: LayoutTemplate },
    { type: 'section', label: 'Config' },
    { type: 'item', to: '/dashboard/admin/settings', label: 'App Settings', icon: Sliders },
  ],
  vendor: [
    { type: 'item', to: '/dashboard/vendor', label: 'Overview', icon: LayoutDashboard, end: true },
    { type: 'section', label: 'Store' },
    { type: 'item', to: '/dashboard/vendor/products', label: 'Products', icon: Package },
    { type: 'item', to: '/dashboard/vendor/inventory', label: 'Inventory', icon: Warehouse },
    { type: 'item', to: '/dashboard/vendor/categories', label: 'Categories', icon: Tag },
    { type: 'section', label: 'Sales' },
    { type: 'item', to: '/dashboard/vendor/orders', label: 'Orders', icon: ShoppingBag },
    { type: 'item', to: '/dashboard/vendor/manual-orders', label: 'Manual Orders', icon: ClipboardList },
    { type: 'section', label: 'Finance' },
    { type: 'item', to: '/dashboard/vendor/settlements', label: 'Settlements', icon: IndianRupee },
    { type: 'section', label: 'Grow' },
    { type: 'item', to: '/dashboard/vendor/ads', label: 'Ad Campaigns', icon: Megaphone },
    { type: 'section', label: 'Account' },
    { type: 'item', to: '/dashboard/vendor/settings', label: 'Settings', icon: Settings },
    { type: 'item', to: '/dashboard/vendor/support', label: 'Support', icon: HelpCircle },
  ],
  customer: [
    { type: 'item', to: '/dashboard/customer', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { type: 'item', to: '/dashboard/customer/orders', label: 'My Orders', icon: ShoppingBag, badge: 'orders' },
    { type: 'item', to: '/dashboard/customer/addresses', label: 'Addresses', icon: MapPin },
    { type: 'item', to: '/dashboard/customer/wishlist', label: 'Wishlist', icon: Heart },
    { type: 'item', to: '/dashboard/customer/settings', label: 'Settings', icon: Settings },
    { type: 'section', label: 'Grow' },
    { type: 'item', to: '/sell', label: 'Become a Vendor', icon: Store },
    { type: 'item', to: '/affiliate', label: 'Become an Affiliate', icon: UserCheck },
  ],
  affiliate: [
    { type: 'item', to: '/dashboard/affiliate', label: 'Overview', icon: LayoutDashboard, end: true },
    { type: 'section', label: 'Promotions' },
    { type: 'item', to: '/dashboard/affiliate/links', label: 'My Links', icon: Link2 },
    { type: 'item', to: '/dashboard/affiliate/product-links', label: 'All Product Links', icon: Package },
    { type: 'section', label: 'Finance' },
    { type: 'item', to: '/dashboard/affiliate/commissions', label: 'Commissions', icon: IndianRupee },
    { type: 'section', label: 'Account' },
    { type: 'item', to: '/dashboard/affiliate/settings', label: 'Settings', icon: Settings },
    { type: 'item', to: '/dashboard/affiliate/kyc', label: 'KYC Verification', icon: ShieldCheck },
    { type: 'item', to: '/dashboard/affiliate/support', label: 'Support', icon: HelpCircle },
  ],
};

function SidebarContent({ navItems, user, activeOrderCount, onNav, onLogout }) {
  return (
    <>
      <div className="px-4 py-5 border-b border-white/10 text-center shrink-0">
        <NavLink to="/" className="text-xl font-bold text-blue-400">Macgly</NavLink>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) =>
          item.type === 'section' ? (
            <p key={`s-${i}`} className="px-4 pt-5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">
              {item.label}
            </p>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNav}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={16} />
              <span className="flex-1">{item.label}</span>
              {item.badge === 'orders' && activeOrderCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {activeOrderCount > 99 ? '99+' : activeOrderCount}
                </span>
              )}
            </NavLink>
          )
        )}
      </nav>

      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-semibold text-gray-300 truncate">{user.name}</p>
          <p className="text-[11px] text-gray-600 truncate">{user.email}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout({ requiredRole }) {
  const { user, isInitialized } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (user?.role !== 'customer') return;
    api.get('/orders', { params: { limit: 50 } })
      .then((r) => {
        const active = (r.data.orders || []).filter(
          (o) => !['delivered', 'cancelled', 'returned'].includes(o.status)
        );
        setActiveOrderCount(active.length);
      })
      .catch(() => {});
  }, [user?._id, user?.role]);

  if (!isInitialized) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  const isVendor = requiredRole === 'vendor' && user.role === 'vendor';
  const needsOnboarding = isVendor && !user.vendorProfile?.onboardingComplete;
  const isUnapprovedVendor = isVendor && user.vendorProfile?.onboardingComplete && !user.vendorProfile?.approved;
  const isSupportPage = location.pathname.endsWith('/support');
  const navItems = navsByRole[requiredRole || user.role] || navsByRole.customer;

  const currentNavLabel = navItems.find(
    (item) => item.type === 'item' && (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  )?.label || 'Dashboard';

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
      dispatch(clearUser());
      navigate('/');
    } catch {
      toast.error('Logout failed');
    }
  }

  const sidebarProps = { navItems, user, activeOrderCount, onNav: () => setSidebarOpen(false), onLogout: handleLogout };

  return (
    <div className="h-screen flex bg-secondary-50 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-[#0f1117] flex-col shrink-0 h-full">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-[#0f1117] flex flex-col z-50 md:hidden transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
        >
          <X size={18} />
        </button>
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-secondary-200 shrink-0 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-secondary-600 hover:bg-secondary-100 rounded-lg"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-secondary-800 text-base">{currentNavLabel}</span>
        </div>

        <div className="flex-1 p-4 md:p-6">
          {(needsOnboarding && !isSupportPage) ? (
            <VendorOnboarding />
          ) : (isUnapprovedVendor && !isSupportPage) ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock size={32} className="text-yellow-500" />
              </div>
              <h2 className="text-2xl font-bold text-secondary-900">Pending Approval</h2>
              <p className="text-secondary-500 max-w-md">
                Your vendor account is under review. Our team will approve it within 1 business day.
                You'll get full access to your dashboard, products, and orders once approved.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-6 py-4 max-w-sm text-sm text-yellow-800 space-y-1">
                <p className="font-semibold">What happens next?</p>
                <p>1. Admin reviews your application</p>
                <p>2. You receive approval notification</p>
                <p>3. Full dashboard access unlocked</p>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}
