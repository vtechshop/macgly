import { Link } from 'react-router-dom';
import { Zap, Wrench, Settings, Hammer, HardHat, Package, Ruler, Flame, Scissors } from 'lucide-react';
import { useFetch } from '../../hooks';
import api from '../../utils/api';
import { normalizeImageUrl } from '../../utils/format';
import Spinner from '../components/common/Spinner';

const CATEGORY_ICONS = {
  'power-tools': Zap,
  'hand-tools': Wrench,
  'spare-parts': Settings,
  machines: Hammer,
  safety: HardHat,
  'measuring-tools': Ruler,
  welding: Flame,
  'cutting-tools': Scissors,
  default: Package,
};

export default function AllCategories() {
  const { data, isLoading } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const categories = data?.categories || [];
  const parents = categories.filter((c) => !c.parentId);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-secondary-900">All Categories</h1>
        <p className="text-sm text-secondary-400 mt-1">Browse all product categories</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {parents.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default;
          return (
            <Link
              key={cat._id}
              to={`/category/${cat.slug}`}
              className="flex flex-col rounded-xl border-2 border-secondary-200 bg-white hover:border-primary-300 hover:shadow-sm transition-all duration-150 group overflow-hidden"
            >
              <div className="w-full aspect-square bg-secondary-50 flex items-center justify-center group-hover:bg-secondary-100 transition-colors">
                {cat.image
                  ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-full h-full object-contain p-2" onError={(e) => { e.target.style.display = 'none'; }} />
                  : <div className="text-secondary-400 group-hover:text-primary-500 transition-colors"><Icon size={32} /></div>
                }
              </div>
              <div className="px-2 py-2 text-center">
                <span className="text-xs font-semibold leading-tight line-clamp-2 text-secondary-700 group-hover:text-primary-700">
                  {cat.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {parents.length === 0 && !isLoading && (
        <div className="flex items-center justify-center py-20">
          <p className="text-secondary-400">No categories found</p>
        </div>
      )}
    </div>
  );
}
