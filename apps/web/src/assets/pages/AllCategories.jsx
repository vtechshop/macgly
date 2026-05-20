import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Wrench, Settings, Hammer, HardHat, Package, Ruler, Flame, Scissors, ChevronRight } from 'lucide-react';
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

function CatIcon({ cat, size = 18 }) {
  const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default;
  if (cat.image) {
    return (
      <img
        src={normalizeImageUrl(cat.image)}
        alt=""
        style={{ width: size, height: size }}
        className="object-contain"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  return <Icon size={size} />;
}

export default function AllCategories() {
  const { data, isLoading } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const categories = data?.categories || [];
  const parents = categories.filter((c) => !c.parentId);
  const childrenMap = {};
  categories.forEach((c) => {
    if (c.parentId) {
      const key = c.parentId.toString();
      if (!childrenMap[key]) childrenMap[key] = [];
      childrenMap[key].push(c);
    }
  });

  const [activeId, setActiveId] = useState(null);
  const activeCat = parents.find((p) => p._id === (activeId || parents[0]?._id));
  const activeChildren = childrenMap[activeCat?._id] || [];

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left sidebar */}
      <aside className="w-52 shrink-0 border-r border-secondary-200 bg-secondary-50">
        <div className="px-4 py-3 border-b border-secondary-200">
          <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Choose a Category</h2>
        </div>
        <nav className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 110px)' }}>
          {parents.map((cat) => (
            <Link
              key={cat._id}
              to={childrenMap[cat._id]?.length ? '#' : `/category/${cat.slug}`}
              onClick={() => setActiveId(cat._id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors border-l-2 ${
                cat._id === (activeId || parents[0]?._id)
                  ? 'border-primary-500 bg-white text-primary-600 font-semibold'
                  : 'border-transparent text-secondary-700 hover:bg-white hover:text-secondary-900'
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Right content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {activeCat && (
          <>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-secondary-200">
              <h1 className="text-xl font-bold text-primary-600">{activeCat.name}</h1>
              <Link
                to={`/category/${activeCat.slug}`}
                className="text-sm text-primary-600 hover:underline flex items-center gap-1 font-medium"
              >
                View all {activeCat.name} <ChevronRight size={14} />
              </Link>
            </div>

            {activeChildren.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {activeChildren.map((sub) => (
                  <Link
                    key={sub._id}
                    to={`/category/${sub.slug}`}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-secondary-200 hover:border-primary-400 hover:shadow-md hover:bg-primary-50 transition-all group text-center"
                  >
                    <div className="w-16 h-16 flex items-center justify-center rounded-lg bg-secondary-50 group-hover:bg-white border border-secondary-100 overflow-hidden">
                      {sub.image ? (
                        <img
                          src={normalizeImageUrl(sub.image)}
                          alt={sub.name}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="text-secondary-400 group-hover:text-primary-500 transition-colors">
                          <CatIcon cat={sub} size={28} />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-secondary-700 group-hover:text-primary-600 leading-tight font-medium">{sub.name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mb-4 text-primary-400">
                  <CatIcon cat={activeCat} size={36} />
                </div>
                <p className="text-secondary-500 mb-4">Browse all products in {activeCat.name}</p>
                <Link
                  to={`/category/${activeCat.slug}`}
                  className="btn-primary px-6"
                >
                  Shop {activeCat.name} <ChevronRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}

        {parents.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full py-20">
            <p className="text-secondary-400">No categories found</p>
          </div>
        )}
      </main>
    </div>
  );
}
