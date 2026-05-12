import { Link } from 'react-router-dom';

export default function Privacy() {
  const sections = [
    { title: 'Information We Collect', body: 'We collect information you provide directly: name, email address, phone number, and shipping addresses when you register or place an order. We also collect device and usage data (IP address, browser type, pages visited) to improve our platform.' },
    { title: 'How We Use Your Information', body: 'We use your information to process orders and payments, send order confirmations and shipping updates, provide customer support, personalise your shopping experience, and send promotional communications (only with your consent).' },
    { title: 'Sharing Your Information', body: 'We share your information only with: (a) vendors to fulfil your orders, (b) logistics partners to deliver your orders, (c) payment processors to handle transactions, and (d) law enforcement when legally required. We never sell your personal data to third parties.' },
    { title: 'Cookies', body: 'We use cookies to keep you signed in, remember your cart, and analyse site traffic. You can disable cookies in your browser settings, but some features may not function correctly.' },
    { title: 'Data Security', body: 'We implement industry-standard security measures including HTTPS encryption, hashed passwords, and HttpOnly cookies. However, no internet transmission is 100% secure, and we cannot guarantee absolute security.' },
    { title: 'Data Retention', body: 'We retain your account data for as long as your account is active. Order records are retained for 7 years for tax compliance. You may request deletion of your account data by contacting us.' },
    { title: 'Your Rights', body: 'You have the right to access, correct, or delete your personal data. You may also opt out of marketing communications at any time. To exercise these rights, please contact our support team.' },
    { title: 'Children\'s Privacy', body: 'Macgly is not intended for users under the age of 18. We do not knowingly collect personal information from minors.' },
    { title: 'Changes to This Policy', body: 'We may update this Privacy Policy periodically. We will notify you of significant changes by email or a prominent notice on our platform.' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-secondary-500 text-sm mb-8">Last updated: April 2026</p>
      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="font-bold text-secondary-900 mb-1">{s.title}</h2>
            <p className="text-secondary-600 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
        <p className="text-sm text-secondary-600 pt-4 border-t border-secondary-100">
          Questions about your data? <Link to="/info/contact" className="text-primary-600 hover:underline font-medium">Contact us</Link>.
        </p>
      </div>
    </div>
  );
}
