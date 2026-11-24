import { Outlet } from 'react-router-dom';
import AnnouncementBar from './AnnouncementBar';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import WhatsAppFAB from '../common/WhatsAppFAB';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Header />
      <main className="flex-1 bg-[#F6F6F6]">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppFAB />
    </div>
  );
}
