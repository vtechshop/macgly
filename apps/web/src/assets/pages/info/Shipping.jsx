import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Clock, MapPin, Package, IndianRupee, ShieldCheck } from 'lucide-react';
import { setMeta } from '../../../utils/seo';

export default function Shipping() {
  useEffect(() => {
    setMeta({
      title:       'Shipping Policy | Macgly',
      description: 'Macgly ships to all major cities and pin codes across India. Learn about delivery times, shipping partners, free shipping, and how to track your order.',
      canonical:   'https://www.macgly.com/info/shipping',
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-secondary-400 mb-6 flex items-center gap-1.5">
        <Link to="/" className="hover:text-secondary-700">Home</Link>
        <span>/</span>
        <span className="text-secondary-700 font-medium">Shipping Policy</span>
      </nav>

      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Shipping Policy</h1>
      <p className="text-secondary-500 mb-8">
        Last updated: September 2024. We ship to all major cities and most pin codes across India.
      </p>

      {/* Key facts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        {[
          { icon: Clock, label: 'Delivery time', value: '3–5 business days' },
          { icon: MapPin, label: 'Coverage', value: 'Pan-India delivery' },
          { icon: IndianRupee, label: 'Free shipping', value: '[PLACEHOLDER: above ₹X]' },
          { icon: Package, label: 'Shipping partner', value: 'Delhivery & others' },
          { icon: ShieldCheck, label: 'GST invoice', value: 'Included on all orders' },
          { icon: Truck, label: 'Tracking', value: 'Full order tracking' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-secondary-50 border border-secondary-200 rounded-xl p-4 text-center">
            <Icon size={22} className="text-primary-600 mx-auto mb-2" />
            <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-secondary-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Delivery Coverage</h2>
          <p className="text-secondary-600 leading-relaxed">
            Macgly delivers to all major cities and most pin codes across India, including metro cities
            (Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Kolkata, Pune, Ahmedabad) and smaller towns.
            You can verify delivery availability for your pin code on any product page before placing an order.
          </p>
          <p className="text-secondary-600 leading-relaxed mt-3">
            [PLACEHOLDER: Add any pin codes or regions that are NOT currently serviceable, or remove this sentence if pan-India coverage is complete.]
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Delivery Timeframes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-secondary-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-secondary-100">
                  <th className="px-4 py-2.5 text-left font-semibold text-secondary-700 border-b border-secondary-200">Zone</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-secondary-700 border-b border-secondary-200">Estimated Delivery</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Metro cities (Tier 1)', '2–4 business days'],
                  ['Tier 2 cities', '3–5 business days'],
                  ['Tier 3 towns & rural areas', '5–7 business days'],
                  ['Remote / special delivery zones', '7–10 business days'],
                ].map(([zone, time], i) => (
                  <tr key={zone} className={i % 2 === 0 ? 'bg-white' : 'bg-secondary-50'}>
                    <td className="px-4 py-2.5 border-b border-secondary-100 text-secondary-700 font-medium">{zone}</td>
                    <td className="px-4 py-2.5 border-b border-secondary-100 text-secondary-600">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-secondary-400 mt-2">
            Delivery timeframes are estimates and may vary due to public holidays, extreme weather, or logistics delays.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Shipping Charges</h2>
          <p className="text-secondary-600 leading-relaxed">
            [PLACEHOLDER: Describe your shipping charge structure — e.g., "Free shipping on orders above ₹X. Orders below ₹X are charged ₹Y for standard delivery. Heavy or oversized items may attract additional shipping charges."]
          </p>
          <p className="text-secondary-600 leading-relaxed mt-3">
            Exact shipping charges (if applicable) are shown at checkout before payment, based on your delivery pin code and the weight of the items ordered.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Shipping Partners</h2>
          <p className="text-secondary-600 leading-relaxed">
            Macgly ships orders via <strong>Delhivery</strong> and other reputed logistics partners.
            The shipping partner is selected based on your delivery location and the nature of the product.
          </p>
          <p className="text-secondary-600 leading-relaxed mt-3">
            [PLACEHOLDER: Add any other shipping partners if applicable — e.g., BlueDart, DTDC, Ekart, etc.]
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Order Tracking</h2>
          <p className="text-secondary-600 leading-relaxed">
            Once your order is shipped, you will receive an email or SMS with the tracking number and a
            link to track your shipment. You can also track your order from your{' '}
            <Link to="/dashboard/customer/orders" className="text-primary-600 hover:underline">
              My Orders
            </Link>{' '}
            page, or use the{' '}
            <Link to="/track-order" className="text-primary-600 hover:underline">
              Track Order
            </Link>{' '}
            tool with your order ID and email address.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Heavy or Large Items</h2>
          <p className="text-secondary-600 leading-relaxed">
            [PLACEHOLDER: Describe how heavy machinery or large items are shipped — e.g., "Heavy machinery (above X kg) may be shipped via road freight. Estimated delivery for such items is 5–10 business days. You will be contacted separately with delivery details." Or remove this section if not applicable.]
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">GST Invoice</h2>
          <p className="text-secondary-600 leading-relaxed">
            A GST-compliant tax invoice is automatically generated for every order and is available to
            download from your{' '}
            <Link to="/dashboard/customer/orders" className="text-primary-600 hover:underline">
              My Orders
            </Link>{' '}
            page after your order is confirmed. This invoice can be used for input tax credit (ITC)
            claims by registered businesses.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900 mb-3">Damaged or Lost Shipments</h2>
          <p className="text-secondary-600 leading-relaxed">
            If your order arrives damaged or does not arrive within the expected delivery window, please
            contact us immediately. Do not accept physically damaged packages — take photos and refuse
            delivery. Report the issue via the{' '}
            <Link to="/info/contact" className="text-primary-600 hover:underline">
              Contact Us
            </Link>{' '}
            page or WhatsApp us at{' '}
            <a href="https://wa.me/919944556683" className="text-primary-600 hover:underline">
              +91 99445 56683
            </a>
            .
          </p>
        </section>
      </div>

      {/* Related links */}
      <div className="mt-10 border-t border-secondary-200 pt-6 flex flex-wrap gap-4 text-sm">
        <Link to="/info/returns" className="text-primary-600 hover:underline font-medium">Returns & Refund Policy →</Link>
        <Link to="/info/faq" className="text-primary-600 hover:underline font-medium">FAQs →</Link>
        <Link to="/track-order" className="text-primary-600 hover:underline font-medium">Track Your Order →</Link>
        <Link to="/info/contact" className="text-primary-600 hover:underline font-medium">Contact Us →</Link>
      </div>
    </div>
  );
}
