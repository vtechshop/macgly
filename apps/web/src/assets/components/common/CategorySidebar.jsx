import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Wrench, Settings, Hammer, HardHat, Package, Ruler, Flame, Scissors, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { normalizeImageUrl } from '../../../utils/format';

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

function CatIcon({ cat, size = 16, className = '' }) {
  const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default;
  if (cat.image) {
    return <img src={normalizeImageUrl(cat.image)} alt="" className={`object-contain ${className}`} style={{ width: size, height: size }} onError={(e) => { e.target.style.display = 'none'; }} />;
  }
  return <Icon size={size} />;
}

export default function CategorySidebar({ categories }) {
  const parents = categories.filter(c => !c.parentId);

  const childrenMap = {};
  categories.forEach(c => {
    if (c.parentId) {
      const key = c.parentId.toString();
      if (!childrenMap[key]) childrenMap[key] = [];
      childrenMap[key].push(c);
    }
  });

  const [hoveredId, setHoveredId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const activeId = hoveredId || parents[0]?._id;
  const activeCat = parents.find(p => p._id === activeId);
  const activeChildren = childrenMap[activeId] || [];

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ minHeight: 340 }}>
        {/* Left: parent categories */}
        <div className="w-52 bg-secondary-50 border-r border-secondary-200 shrink-0 overflow-y-auto">
          {parents.map(cat => {
            const isActive = cat._id === activeId;
            const hasChildren = !!(childrenMap[cat._id]?.length);
            return (
              <div
                key={cat._id}
                onMouseEnter={() => setHoveredId(cat._id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                  isActive
                    ? 'bg-white border-r-2 border-primary-500 text-primary-600'
                    : 'text-secondary-700 hover:bg-white'
                }`}
              >
                <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${isActive ? 'bg-primary-50 text-primary-600' : 'bg-secondary-200 text-secondary-500'}`}>
                  <CatIcon cat={cat} size={14} />
                </div>
                <span className="text-xs font-medium flex-1 leading-tight">{cat.name}</span>
                {hasChildren && <ChevronRight size={11} className="opacity-40 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Right: subcategories panel */}
        <div className="flex-1 p-4 bg-white">
          {activeCat && (
            <>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-secondary-100">
                <h3 className="text-sm font-bold text-secondary-800">{activeCat.name}</h3>
                <Link to={`/category/${activeCat.slug}`} className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-0.5">
                  View all <ChevronRight size={11} />
                </Link>
              </div>

              {activeChildren.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {activeChildren.map(sub => (
                    <Link
                      key={sub._id}
                      to={`/category/${sub.slug}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary-50 group transition-colors"
                    >
                      <div className="w-8 h-8 rounded bg-secondary-100 group-hover:bg-primary-100 flex items-center justify-center shrink-0 text-secondary-500 group-hover:text-primary-500 transition-colors">
                        <CatIcon cat={sub} size={15} />
                      </div>
                      <span className="text-xs font-medium text-secondary-700 group-hover:text-primary-600 leading-tight">{sub.name}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  to={`/category/${activeCat.slug}`}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 font-semibold hover:underline mt-2"
                >
                  Shop {activeCat.name} <ChevronRight size={14} />
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile: accordion */}
      <div className="md:hidden divide-y divide-secondary-100">
        {parents.map(cat => {
          const isOpen = openId === cat._id;
          const children = childrenMap[cat._id] || [];

          const inner = (
            <>
              <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isOpen ? 'bg-primary-50 text-primary-500' : 'bg-secondary-100 text-secondary-500'}`}>
                <CatIcon cat={cat} size={16} />
              </div>
              <span className="flex-1 text-sm font-medium text-secondary-800 text-left">{cat.name}</span>
              {children.length > 0
                ? isOpen ? <ChevronUp size={15} className="text-secondary-400 shrink-0" /> : <ChevronDown size={15} className="text-secondary-400 shrink-0" />
                : <ChevronRight size={15} className="text-secondary-400 shrink-0" />
              }
            </>
          );

          return (
            <div key={cat._id}>
              {children.length > 0 ? (
                <button
                  onClick={() => setOpenId(isOpen ? null : cat._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-secondary-50 transition-colors"
                >
                  {inner}
                </button>
              ) : (
                <Link to={`/category/${cat.slug}`} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-secondary-50 transition-colors">
                  {inner}
                </Link>
              )}

              {isOpen && children.length > 0 && (
                <div className="bg-secondary-50 px-4 py-3 grid grid-cols-2 gap-2">
                  {children.map(sub => (
                    <Link
                      key={sub._id}
                      to={`/category/${sub.slug}`}
                      className="flex items-center gap-2 p-2 rounded bg-white hover:bg-primary-50 transition-colors group"
                    >
                      <div className="w-6 h-6 rounded bg-secondary-100 group-hover:bg-primary-100 flex items-center justify-center shrink-0 text-secondary-500">
                        <CatIcon cat={sub} size={12} />
                      </div>
                      <span className="text-xs text-secondary-700 group-hover:text-primary-600 leading-tight">{sub.name}</span>
                    </Link>
                  ))}
                  <Link to={`/category/${cat.slug}`} className="col-span-2 text-xs text-primary-600 font-semibold pt-1 hover:underline">
                    View all {cat.name} →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
