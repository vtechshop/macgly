import ProductCard from './ProductCard';

function ProductSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-secondary-100 animate-pulse">
      <div className="bg-secondary-100" style={{ aspectRatio: '4/3' }} />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-secondary-100 rounded w-3/4" />
        <div className="h-3 bg-secondary-100 rounded w-1/2" />
        <div className="h-5 bg-secondary-100 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

export default function ProductGrid({ products, loading, onAddToCart }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="text-center py-20 text-secondary-400">
        <p className="text-lg font-medium">No products found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
