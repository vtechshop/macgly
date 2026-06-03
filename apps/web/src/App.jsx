import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, clearUser } from './store/slices/authSlice';
import { setCart } from './store/slices/cartSlice';
import api from './utils/api';
import Spinner from './assets/components/common/Spinner';

import PublicLayout from './assets/components/layout/PublicLayout';
import DashboardLayout from './assets/components/layout/DashboardLayout';

// Public pages — lazy loaded
const Home                  = lazy(() => import('./assets/pages/Home'));
const Search                = lazy(() => import('./assets/pages/Search'));
const Product               = lazy(() => import('./assets/pages/Product'));
const Login                 = lazy(() => import('./assets/pages/Login'));
const Register              = lazy(() => import('./assets/pages/Register'));
const ForgotPassword        = lazy(() => import('./assets/pages/ForgotPassword'));
const ResetPassword         = lazy(() => import('./assets/pages/ResetPassword'));
const Cart                  = lazy(() => import('./assets/pages/Cart'));
const Checkout              = lazy(() => import('./assets/pages/Checkout'));
const OrderConfirmation     = lazy(() => import('./assets/pages/OrderConfirmation'));
const VendorRegister        = lazy(() => import('./assets/pages/VendorRegister'));
const AffiliateRegister     = lazy(() => import('./assets/pages/AffiliateRegister'));
const Category              = lazy(() => import('./assets/pages/Category'));
const AllCategories         = lazy(() => import('./assets/pages/AllCategories'));
const VendorStore           = lazy(() => import('./assets/pages/VendorStore'));
const Blog                  = lazy(() => import('./assets/pages/Blog'));
const BlogPost              = lazy(() => import('./assets/pages/BlogPost'));
const TrackOrder            = lazy(() => import('./assets/pages/TrackOrder'));
const WarrantyCheck         = lazy(() => import('./assets/pages/WarrantyCheck'));
const About                 = lazy(() => import('./assets/pages/info/About'));
const Contact               = lazy(() => import('./assets/pages/info/Contact'));
const Privacy               = lazy(() => import('./assets/pages/info/Privacy'));
const NotFound              = lazy(() => import('./assets/pages/NotFound'));
const Terms                 = lazy(() => import('./assets/pages/info/Terms'));

// Admin pages — lazy loaded
const AdminDashboard        = lazy(() => import('./assets/pages/dashboard/admin/AdminDashboard'));
const AdminProducts         = lazy(() => import('./assets/pages/dashboard/admin/AdminProducts'));
const AdminOrders           = lazy(() => import('./assets/pages/dashboard/admin/AdminOrders'));
const AdminUsers            = lazy(() => import('./assets/pages/dashboard/admin/AdminUsers'));
const AdminCategories       = lazy(() => import('./assets/pages/dashboard/admin/AdminCategories'));
const AdminBanners          = lazy(() => import('./assets/pages/dashboard/admin/AdminBanners'));
const AdminVendors          = lazy(() => import('./assets/pages/dashboard/admin/AdminVendors'));
const AdminAffiliates       = lazy(() => import('./assets/pages/dashboard/admin/AdminAffiliates'));
const AdminTickets          = lazy(() => import('./assets/pages/dashboard/admin/AdminTickets'));
const AdminPayments         = lazy(() => import('./assets/pages/dashboard/admin/AdminPayments'));
const AdminKYC              = lazy(() => import('./assets/pages/dashboard/admin/AdminKYC'));
const AdminReviews          = lazy(() => import('./assets/pages/dashboard/admin/AdminReviews'));
const AdminWarranty         = lazy(() => import('./assets/pages/dashboard/admin/AdminWarranty'));
const AdminInventory        = lazy(() => import('./assets/pages/dashboard/admin/AdminInventory'));
const AdminCRM              = lazy(() => import('./assets/pages/dashboard/admin/AdminCRM'));
const AdminCommunications   = lazy(() => import('./assets/pages/dashboard/admin/AdminCommunications'));
const AdminContactSubmissions = lazy(() => import('./assets/pages/dashboard/admin/AdminContactSubmissions'));
const AdminManualOrders     = lazy(() => import('./assets/pages/dashboard/admin/AdminManualOrders'));
const AdminBlog             = lazy(() => import('./assets/pages/dashboard/admin/AdminBlog'));
const AdminCMS              = lazy(() => import('./assets/pages/dashboard/admin/AdminCMS'));
const AdminSettings         = lazy(() => import('./assets/pages/dashboard/admin/AdminSettings'));
const AdminShareCatalog     = lazy(() => import('./assets/pages/dashboard/admin/AdminShareCatalog'));
const AdminOrderDetail      = lazy(() => import('./assets/pages/dashboard/admin/AdminOrderDetail'));
const AdminCarousel         = lazy(() => import('./assets/pages/dashboard/admin/AdminCarousel'));
const AdminCommissions      = lazy(() => import('./assets/pages/dashboard/admin/AdminCommissions'));
const AdminReturns          = lazy(() => import('./assets/pages/dashboard/admin/AdminReturns'));
const AdminAdsManagement    = lazy(() => import('./assets/pages/dashboard/admin/AdminAdsManagement'));
const AdminAnalytics        = lazy(() => import('./assets/pages/dashboard/admin/AdminAnalytics'));

// Vendor pages — lazy loaded
const VendorDashboard       = lazy(() => import('./assets/pages/dashboard/vendor/VendorDashboard'));
const VendorProducts        = lazy(() => import('./assets/pages/dashboard/vendor/VendorProducts'));
const VendorOrders          = lazy(() => import('./assets/pages/dashboard/vendor/VendorOrders'));
const VendorOrderDetail     = lazy(() => import('./assets/pages/dashboard/vendor/VendorOrderDetail'));
const VendorSupport         = lazy(() => import('./assets/pages/dashboard/vendor/VendorSupport'));
const VendorKYC             = lazy(() => import('./assets/pages/dashboard/vendor/VendorKYC'));
const VendorInventory       = lazy(() => import('./assets/pages/dashboard/vendor/VendorInventory'));
const VendorSettlements     = lazy(() => import('./assets/pages/dashboard/vendor/VendorSettlements'));
const VendorAds             = lazy(() => import('./assets/pages/dashboard/vendor/VendorAds'));
const VendorCategories      = lazy(() => import('./assets/pages/dashboard/vendor/VendorCategories'));
const VendorManualOrders    = lazy(() => import('./assets/pages/dashboard/vendor/VendorManualOrders'));
const VendorSettings        = lazy(() => import('./assets/pages/dashboard/vendor/VendorSettings'));

// Customer pages — lazy loaded
const BecomeVendor          = lazy(() => import('./assets/pages/dashboard/customer/BecomeVendor'));
const BecomeAffiliate       = lazy(() => import('./assets/pages/dashboard/customer/BecomeAffiliate'));
const CustomerDashboard     = lazy(() => import('./assets/pages/dashboard/customer/CustomerDashboard'));
const CustomerOrders        = lazy(() => import('./assets/pages/dashboard/customer/CustomerOrders'));
const CustomerOrderDetail   = lazy(() => import('./assets/pages/dashboard/customer/CustomerOrderDetail'));
const CustomerAddresses     = lazy(() => import('./assets/pages/dashboard/customer/CustomerAddresses'));
const CustomerWishlist      = lazy(() => import('./assets/pages/dashboard/customer/CustomerWishlist'));
const CustomerSettings      = lazy(() => import('./assets/pages/dashboard/customer/CustomerSettings'));

// Affiliate pages — lazy loaded
const AffiliateDashboard    = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateDashboard'));
const AffiliateEarnings     = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateEarnings'));
const AffiliateLinks        = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateLinks'));
const AffiliateProductLinks = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateProductLinks'));
const AffiliateSettings     = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateSettings'));
const AffiliateKYC          = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateKYC'));
const AffiliateSupport      = lazy(() => import('./assets/pages/dashboard/affiliate/AffiliateSupport'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  );
}

function AuthInit({ children }) {
  const dispatch = useDispatch();
  useEffect(() => {
    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => { if (!cancelled) dispatch(setUser(data.user)); })
      .catch(() => { if (!cancelled) dispatch(clearUser()); });
    api.get('/cart')
      .then(({ data }) => { if (!cancelled && data.cart) dispatch(setCart(data.cart)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dispatch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('aff') || params.get('aff_ref');
    if (ref && /^[A-Z0-9]{6,12}$/.test(ref)) {
      localStorage.setItem('aff_ref', JSON.stringify({ ref, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
      api.get(`/affiliates/record-click?ref=${ref}`).catch(() => {});
      params.delete('aff');
      params.delete('aff_ref');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash);
    }
  }, []);

  return children;
}

function RequireAuth({ children }) {
  const { user, isInitialized } = useSelector((s) => s.auth);
  if (!isInitialized) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthInit>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth — standalone, no navbar/footer */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Public — wrapped in PublicLayout (has navbar + footer) */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Search />} />
              <Route path="/product/:slug" element={<Product />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/sell" element={<VendorRegister />} />
              <Route path="/affiliate" element={<AffiliateRegister />} />
              <Route path="/info/about" element={<About />} />
              <Route path="/info/contact" element={<Contact />} />
              <Route path="/info/privacy" element={<Privacy />} />
              <Route path="/info/terms" element={<Terms />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/warranty-check" element={<WarrantyCheck />} />
              <Route path="/store/:id" element={<VendorStore />} />
              <Route path="/categories" element={<AllCategories />} />
              <Route path="/category/:slug" element={<Category />} />
            </Route>

            {/* Checkout — protected */}
            <Route path="/checkout" element={<RequireAuth><PublicLayout /></RequireAuth>}>
              <Route index element={<Checkout />} />
            </Route>
            <Route path="/order-confirmation/:orderId" element={<RequireAuth><PublicLayout /></RequireAuth>}>
              <Route index element={<OrderConfirmation />} />
            </Route>

            {/* Admin dashboard */}
            <Route path="/dashboard/admin" element={<DashboardLayout requiredRole="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="banners" element={<AdminBanners />} />
              <Route path="vendors" element={<AdminVendors />} />
              <Route path="affiliates" element={<AdminAffiliates />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="kyc" element={<AdminKYC />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="warranty" element={<AdminWarranty />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="crm" element={<AdminCRM />} />
              <Route path="communications" element={<AdminCommunications />} />
              <Route path="contact-submissions" element={<AdminContactSubmissions />} />
              <Route path="manual-orders" element={<AdminManualOrders />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="cms" element={<AdminCMS />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="share-catalog" element={<AdminShareCatalog />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
              <Route path="carousel" element={<AdminCarousel />} />
              <Route path="commissions" element={<AdminCommissions defaultType="vendor" />} />
              <Route path="affiliate-commissions" element={<AdminCommissions defaultType="affiliate" />} />
              <Route path="returns" element={<AdminReturns />} />
              <Route path="ads" element={<AdminAdsManagement />} />
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>

            {/* Vendor dashboard */}
            <Route path="/dashboard/vendor" element={<DashboardLayout requiredRole="vendor" />}>
              <Route index element={<VendorDashboard />} />
              <Route path="products" element={<VendorProducts />} />
              <Route path="orders" element={<VendorOrders />} />
              <Route path="orders/:id" element={<VendorOrderDetail />} />
              <Route path="support" element={<VendorSupport />} />
              <Route path="inventory" element={<VendorInventory />} />
              <Route path="settlements" element={<VendorSettlements />} />
              <Route path="ads" element={<VendorAds />} />
              <Route path="categories" element={<VendorCategories />} />
              <Route path="manual-orders" element={<VendorManualOrders />} />
              <Route path="settings" element={<VendorSettings />} />
              <Route path="kyc" element={<VendorKYC />} />
            </Route>

            {/* Become a Vendor — any authenticated user */}
            <Route path="/dashboard/become-vendor" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
              <Route index element={<BecomeVendor />} />
            </Route>

            {/* Become an Affiliate — any authenticated user */}
            <Route path="/dashboard/become-affiliate" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
              <Route index element={<BecomeAffiliate />} />
            </Route>

            {/* Customer dashboard */}
            <Route path="/dashboard/customer" element={<DashboardLayout requiredRole="customer" />}>
              <Route index element={<CustomerDashboard />} />
              <Route path="orders" element={<CustomerOrders />} />
              <Route path="orders/:id" element={<CustomerOrderDetail />} />
              <Route path="addresses" element={<CustomerAddresses />} />
              <Route path="wishlist" element={<CustomerWishlist />} />
              <Route path="settings" element={<CustomerSettings />} />
            </Route>

            {/* Affiliate dashboard */}
            <Route path="/dashboard/affiliate" element={<DashboardLayout requiredRole="affiliate" />}>
              <Route index element={<AffiliateDashboard />} />
              <Route path="links" element={<AffiliateLinks />} />
              <Route path="product-links" element={<AffiliateProductLinks />} />
              <Route path="commissions" element={<AffiliateEarnings />} />
              <Route path="earnings" element={<AffiliateEarnings />} />
              <Route path="settings" element={<AffiliateSettings />} />
              <Route path="kyc" element={<AffiliateKYC />} />
              <Route path="support" element={<AffiliateSupport />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthInit>
    </BrowserRouter>
  );
}
