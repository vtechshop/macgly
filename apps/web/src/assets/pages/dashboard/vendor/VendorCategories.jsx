import { ChevronRight, Tag } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

export default function VendorCategories() {
  const { data, isLoading } = useFetch(
    ['vendor-categories'],
    () => api.get('/admin/categories').then((r) => r.data)
  );

  const categories = data?.categories || [];
  const parents = categories.filter((c) => !c.parent);
  const byParent = {};
  categories.filter((c) => c.parent).forEach((c) => {
    const pid = typeof c.parent === 'object' ? c.parent._id : c.parent;
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push(c);
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Browse available categories to assign to your products</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {parents.map((cat) => (
          <div key={cat._id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              {cat.image ? <img src={cat.image} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center"><Tag size={14} className="text-blue-600" /></div>}
              <p className="font-semibold">{cat.name}</p>
            </div>
            {byParent[cat._id?.toString()]?.length > 0 && (
              <div className="space-y-1 ml-2">
                {byParent[cat._id.toString()].map((sub) => (
                  <div key={sub._id} className="flex items-center gap-1.5 text-sm text-secondary-600">
                    <ChevronRight size={12} className="text-secondary-400" /> {sub.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
