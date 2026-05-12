import { useParams, Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { useFetch } from '../../hooks';
import Spinner from '../components/common/Spinner';

export default function OrderConfirmation() {
  const { orderId } = useParams();

  const { data, isLoading } = useFetch(
    ['order', orderId],
    () => api.get(`/orders/${orderId}`).then((r) => r.data)
  );

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const order = data?.order;

  if (!order) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="text-lg font-medium text-secondary-600">Order not found.</p>
      <Link to="/dashboard/customer/orders" className="mt-4 inline-block btn-primary">My Orders</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
      <p className="text-secondary-500 mb-6">Thank you for your purchase. We'll send you updates by email.</p>

      {order && (
        <div className="card p-5 text-left space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-secondary-500">Order ID</span>
            <span className="font-medium">{order.orderId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary-500">Date</span>
            <span>{formatDate(order.createdAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary-500">Status</span>
            <span className="capitalize font-medium text-green-600">{order.status}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <Link to="/dashboard/customer/orders" className="btn-outline">View My Orders</Link>
        <Link to="/products" className="btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
