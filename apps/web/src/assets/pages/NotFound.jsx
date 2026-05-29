import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="text-8xl font-black text-secondary-200 leading-none select-none">404</div>
      <h1 className="text-2xl font-bold text-secondary-900 mt-4">Page not found</h1>
      <p className="text-secondary-500 mt-2 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-wrap gap-3 mt-8 justify-center">
        <Link to="/" className="btn-primary flex items-center gap-2 px-5">
          <Home size={16} /> Go Home
        </Link>
        <Link to="/products" className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 px-5">
          <Search size={16} /> Browse Products
        </Link>
        <button onClick={() => window.history.back()} className="btn border border-secondary-300 text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 px-5">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    </div>
  );
}
