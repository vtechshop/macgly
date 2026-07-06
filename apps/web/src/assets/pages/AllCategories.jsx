import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks';
import api from '../../utils/api';
import Spinner from '../components/common/Spinner';

export default function AllCategories() {
  const { data, isLoading } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const categories = data?.categories || [];
  const parents = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

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
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-center text-secondary-800 mb-8">Shop by Categories</h1>

      <div className="space-y-6">
        {parents.map((cat) => {
          const subs = (childrenMap[String(cat._id)] || [])
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

          return (
            <div key={cat._id} className="border border-secondary-200 rounded-lg overflow-hidden">
              {/* Parent header */}
              <Link
                to={`/category/${cat.slug}`}
                className="block w-full px-5 py-3 bg-teal-50 border-b border-teal-200 hover:bg-teal-100 transition-colors"
              >
                <span className="text-base font-bold text-teal-700">{cat.name}</span>
              </Link>

              {/* Subcategories grid */}
              {subs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 px-5 py-4 bg-white">
                  {subs.map((sub) => (
                    <Link
                      key={sub._id}
                      to={`/category/${sub.slug}`}
                      className="text-sm text-secondary-600 hover:text-teal-700 hover:underline py-1.5 truncate"
                    >
                      {sub.name}
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
