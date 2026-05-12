import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, clearUser } from './store/slices/authSlice';
import { setCart } from './store/slices/cartSlice';
import api from './utils/api';

import PublicLayout from './assets/components/layout/PublicLayout';
import DashboardLayout from './assets/components/layout/DashboardLayout';

import Home from './assets/pages/Home';
import Search from './assets/pages/Search';
import Product from './assets/pages/Product';
import Login from './assets/pages/Login';
import Register from './assets/pages/Register';
import ForgotPassword from './assets/pages/ForgotPassword';
import ResetPassword from './assets/pages/ResetPassword';
import Cart from './assets/pages/Cart';
import Checkout from './assets/pages/Checkout';
import OrderConfirmation from './assets/pages/OrderConfirmation';

// Dashboard pages
import AdminDashboard from './assets/pages/dashboard/admin/AdminDashboard';
import AdminProducts from './assets/pages/dashboard/admin/AdminProducts';
import AdminOrders from './assets/pages/dashboard/admin/AdminOrders';
import AdminUsers from './assets/pages/dashboard/admin/AdminUsers';
import AdminCategories from './assets/pages/dashboard/admin/AdminCategories';
import AdminBanners from './assets/pages/dashboard/admin/AdminBanners';
import AdminCoupons from './assets/pages/dashboard/admin/AdminCoupons';
import AdminVendors from './assets/pages/dashboard/admin/AdminVendors';
import AdminAffiliates from './assets/pages/dashboard/admin/AdminAffiliates';
import AdminTickets from './assets/pages/dashboard/admin/AdminTickets';
import AdminPayments from './assets/pages/dashboard/admin/AdminPayments';
import AdminKYC from './assets/pages/dashboard/admin/AdminKYC';
import AdminReviews from './assets/pages/dashboard/admin/AdminReviews';
import AdminWarranty from './assets/pages/dashboard/admin/AdminWarranty';

import CustomerWishlist from './assets/pages/dashboard/customer/CustomerWishlist';
import CustomerAddresses from './assets/pages/dashboard/customer/CustomerAddresses';
import VendorDashboard from './assets/pages/dashboard/vendor/VendorDashboard';
import VendorProducts from './assets/pages/dashboard/vendor/VendorProducts';
import VendorOrders from './assets/pages/dashboard/vendor/VendorOrders';
import VendorSupport from './assets/pages/dashboard/vendor/VendorSupport';

import CustomerDashboard from './assets/pages/dashboard/customer/CustomerDashboard';
import CustomerOrders from './assets/pages/dashboard/customer/CustomerOrders';
import CustomerSettings from './assets/pages/dashboard/customer/CustomerSettings';

import AffiliateDashboard from './assets/pages/dashboard/affiliate/AffiliateDashboard';
import AffiliateEarnings from './assets/pages/dashboard/affiliate/AffiliateEarnings';
import AffiliateLinks from './assets/pages/dashboard/affiliate/AffiliateLinks';
import AffiliateProductLinks from './assets/pages/dashboard/affiliate/AffiliateProductLinks';
import AffiliateSettings from './assets/pages/dashboard/affiliate/AffiliateSettings';
import AffiliateKYC from './assets/pages/dashboard/affiliate/AffiliateKYC';
import AffiliateSupport from './assets/pages/dashboard/affiliate/AffiliateSupport';

import VendorRegister from './assets/pages/VendorRegister';
import AffiliateRegister from './assets/pages/AffiliateRegister';

// Info pages
import About from './assets/pages/info/About';
import Contact from './assets/pages/info/Contact';
import Privacy from './assets/pages/info/Privacy';
import Terms from './assets/pages/info/Terms';

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
    // Capture ?aff=CODE from URL (set by affiliate links), store for 30 days
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('aff') || params.get('aff_ref');
    if (ref && /^[A-Z0-9]{6,12}$/.test(ref)) {
      localStorage.setItem('aff_ref', JSON.stringify({ ref, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
      // Fire-and-forget click count
      api.get(`/affiliates/record-click?ref=${ref}`).catch(() => {});
      // Clean the param from URL
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
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Search />} />
            <Route path="/product/:slug" element={<Product />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/sell" element={<VendorRegister />} />
            <Route path="/affiliate" element={<AffiliateRegister />} />
            <Route path="/info/about" element={<About />} />
            <Route path="/info/contact" element={<Contact />} />
            <Route path="/info/privacy" element={<Privacy />} />
            <Route path="/info/terms" element={<Terms />} />
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
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="affiliates" element={<AdminAffiliates />} />
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="kyc" element={<AdminKYC />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="warranty" element={<AdminWarranty />} />
          </Route>

          {/* Vendor dashboard */}
          <Route path="/dashboard/vendor" element={<DashboardLayout requiredRole="vendor" />}>
            <Route index element={<VendorDashboard />} />
            <Route path="products" element={<VendorProducts />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="support" element={<VendorSupport />} />
          </Route>

          {/* Customer dashboard */}
          <Route path="/dashboard/customer" element={<DashboardLayout requiredRole="customer" />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="orders" element={<CustomerOrders />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthInit>
    </BrowserRouter>
  );
}
