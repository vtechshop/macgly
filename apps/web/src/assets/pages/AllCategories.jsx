import { Link } from 'react-router-dom';
import { Sprout, Wrench, Hammer, Cpu, Settings, Package, Home as HomeIcon, Pipette, UtensilsCrossed, Trees, ChevronRight } from 'lucide-react';
import { useFetch } from '../../hooks';
import api from '../../utils/api';
import { normalizeImageUrl } from '../../utils/format';
import Spinner from '../components/common/Spinner';

const CATEGORY_ICONS = {
  'agricultural-industry-farm-tools': Sprout,
  'engineering-workshop-kits':        Wrench,
  'hardware-tools':                   Hammer,
  'electronics-instruments':          Cpu,
  'general-machineries':              Settings,
  'spare-parts':                      Package,
  'household-cleaning-equipment':     HomeIcon,
  'plumbing-hardware-construction':   Pipette,
  'hotel-food-processing':            UtensilsCrossed,
  'wood-carvings':                    Trees,
  default: Package,
};

export default function AllCategories() {
  const { data, isLoading } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const categories = data?.categories || [];
  const parents = categories.filter((c) => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const childrenMap = {};
  categories.forEach((c) => {
    if (c.parentId) {
      const key = String(c.parentId._id || c.parentId);
      if (!childrenMap[key]) childrenMap[key] = [];
      childrenMap[key].push(c);
    }
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-secondary-900">All Categories</h1>
        <p className="text-sm text-secondary-400 mt-1">Browse all categories and subcategories</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parents.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default;
          const subs = (childrenMap[String(cat._id)] || []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
          return (
            <div key={cat._id} className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
              {/* Parent category header */}
              <Link
                to={`/category/${cat.slug}`}
                className="flex items-center gap-3 px-4 py-3 bg-secondary-50 hover:bg-primary-50 border-b border-secondary-200 group transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-secondary-200 flex items-center justify-center shrink-0 overflow-hidden">
                  {cat.image
                    ? <img src={normalizeImageUrl(cat.image)} alt="" className="w-full h-full object-contain p-1" onError={(e) => { e.target.style.display = 'none'; }} />
                    : <Icon size={16} className="text-primary-500" />
                  }
                </div>
                <span className="flex-1 font-bold text-sm text-secondary-800 group-hover:text-primary-700 leading-tight">{cat.name}</span>
                <ChevronRight size={14} className="text-secondary-400 group-hover:text-primary-500 shrink-0" />
              </Link>

              {/* Subcategories */}
              {subs.length > 0 && (
                <div className="divide-y divide-secondary-50">
                  {subs.map((sub) => (
                    <Link
                      key={sub._id}
                      to={`/category/${sub.slug}`}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary-300 group-hover:bg-primary-400 shrink-0" />
                      <span className="text-sm text-secondary-600 group-hover:text-primary-700">{sub.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {parents.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-secondary-400">No categories found</p>
        </div>
      )}
    </div>
  );
}
