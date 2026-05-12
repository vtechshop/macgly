import { useState } from 'react';
import { CheckCircle, Mail, Phone, MapPin } from 'lucide-react';
import api from '../../../utils/api';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      setSent(true);
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not send message. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-secondary-500 mb-8">Have a question, bulk order enquiry, or need technical help? We're here.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact info */}
        <div className="space-y-6">
          <div>
            <h2 className="font-bold text-secondary-800 mb-4">Get in Touch</h2>
            <div className="space-y-4">
              {[
                { icon: Mail, label: 'Email', value: 'support@macgly.com' },
                { icon: Phone, label: 'Phone', value: '+91 98765 43210' },
                { icon: MapPin, label: 'Address', value: 'Tirupur, Tamil Nadu, India' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={15} />
                  </div>
                  <div>
                    <p className="text-xs text-secondary-400 font-medium">{label}</p>
                    <p className="text-sm text-secondary-700">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-secondary-50 rounded-xl p-4 text-sm text-secondary-600 space-y-1">
            <p className="font-semibold text-secondary-800">Business Hours</p>
            <p>Mon–Sat: 9:00 AM – 6:00 PM IST</p>
            <p>Sunday: Closed</p>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          {sent ? (
            <div className="card p-8 text-center space-y-3">
              <CheckCircle size={48} className="mx-auto text-green-500" />
              <h2 className="text-xl font-bold">Message Sent!</h2>
              <p className="text-secondary-500 text-sm">Thank you for reaching out. We'll get back to you within 24 hours.</p>
              <button onClick={() => setSent(false)} className="text-sm text-primary-600 hover:underline font-medium">Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Full Name" value={form.name} onChange={set('name')} required className="col-span-2 sm:col-span-1" />
                <Input label="Email" type="email" value={form.email} onChange={set('email')} required className="col-span-2 sm:col-span-1" />
              </div>
              <Input label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-secondary-700">Message *</label>
                <textarea
                  className="input h-32 resize-none"
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Describe your enquiry, bulk order requirement, or technical question…"
                  required
                  maxLength={2000}
                />
                <p className="text-xs text-secondary-400 text-right">{form.message.length}/2000</p>
              </div>
              <Button type="submit" loading={loading} className="w-full">Send Message</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
