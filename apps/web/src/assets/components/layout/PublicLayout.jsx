import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import WhatsAppFAB from '../common/WhatsAppFAB';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-[#F4F2EE]">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppFAB />
    </div>
  );
}
