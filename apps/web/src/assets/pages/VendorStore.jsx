import { useParams, Link } from 'react-router-dom';
import { Store, Star, Package } from 'lucide-react';
import api from '../utils/api';
import { useFetch } from '../hooks';
import Spinner from './components/common/Spinner';
import ProductCard from './components/ProductCard';

export default function VendorStore() {
  const { id } = useParams();

  const { data: vendorData, isLoading: vendorLoading } = useFetch(
    ['vendor-store', id],
    () => api.get(`/vendors/${id}/public`).then((r) => r.data)
  );

  const { data: productsData, isLoading: productsLoading } = useFetch(
    ['vendor-store-products', id],
    () => api.get('/products', { params: { vendor: id, limit: 48 } }).then((r) => r.data)
  );

  const vendor = vendorData?.vendor;
  const products = productsData?.products || [];

  if (vendorLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  if (!vendor) return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center text-secondary-400">
      <Store size={48} className="mx-auto mb-4 opacity-30" />
      <p className="font-medium text-lg">Store not found</p>
      <Link to="/products" className="btn-primary mt-4 inline-block">Browse Products</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Store header */}
      <div className="card p-6 mb-8 flex items-start gap-5">
        {vendor.logo ? (
          <img src={vendor.logo} alt={vendor.storeName} className="w-20 h-20 rounded-xl object-cover shrink-0 border border-secondary-100" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
            <Store size={36} className="text-primary-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-secondary-900">{vendor.storeName || vendor.name}</h1>
          {vendor.storeDescription && <p className="text-secondary-500 mt-1 text-sm">{vendor.storeDescription}</p>}
          <div className="flex items-center gap-4 mt-3 text-sm text-secondary-500">
            {vendor.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                {vendor.rating.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package size={14} />
              {vendor.productCount || products.length} products
            </span>
            {vendor.location && <span>{vendor.location}</span>}
          </div>
        </div>
      </div>

      {/* Products grid */}
      {productsLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : products.length === 0 ? (
        <div className="card p-16 text-center text-secondary-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products listed yet</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-secondary-500 mb-4">{products.length} product{products.length !== 1 ? 's' : ''} from this store</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
