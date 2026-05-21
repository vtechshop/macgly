import { useState, useRef } from 'react';
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

function CatIcon({ cat, size = 16 }) {
  const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default;
  if (cat.image) {
    return <img src={normalizeImageUrl(cat.image)} alt="" className="object-contain" style={{ width: size, height: size }} onError={(e) => { e.target.style.display = 'none'; }} />;
  }
  return <Icon size={size} />;
}

/* ── Sticky left-nav mode (used on homepage) ─────────────────────────── */
function StickyNav({ parents, childrenMap }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredSubId, setHoveredSubId] = useState(null);
  const leaveTimer = useRef(null);
  const subLeaveTimer = useRef(null);

  const activeCat = parents.find(p => p._id === hoveredId);
  const activeChildren = hoveredId ? (childrenMap[hoveredId] || []) : [];
  const activeGrandChildren = hoveredSubId ? (childrenMap[hoveredSubId] || []) : [];
  const activeSubCat = activeChildren.find(c => c._id === hoveredSubId);

  function enterL1(id) {
    clearTimeout(leaveTimer.current);
    setHoveredId(id);
    setHoveredSubId(null);
  }
  function enterL2(id) {
    clearTimeout(subLeaveTimer.current);
    setHoveredSubId(id);
  }
  function leave() {
    leaveTimer.current = setTimeout(() => { setHoveredId(null); setHoveredSubId(null); }, 150);
  }

  return (
    <div className="relative" onMouseLeave={leave}>
      {/* Level 1 sidebar */}
      <nav className="bg-white border border-secondary-200 shadow-md rounded-lg overflow-hidden w-full">
        <div className="px-3 py-2 bg-secondary-50 border-b border-secondary-200">
          <span className="text-[10px] font-bold text-secondary-500 uppercase tracking-widest">All Categories</span>
        </div>
        {parents.map(cat => {
          const hasChildren = !!(childrenMap[cat._id]?.length);
          const isActive = hoveredId === cat._id;
          return (
            <div
              key={cat._id}
              onMouseEnter={() => enterL1(cat._id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
                isActive
                  ? 'bg-primary-50 border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-700 hover:bg-secondary-50'
              }`}
            >
              <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-primary-100 text-primary-600' : 'bg-secondary-100 text-secondary-500'}`}>
                <CatIcon cat={cat} size={14} />
              </div>
              <span className="text-xs font-medium flex-1 leading-tight">{cat.name}</span>
              {hasChildren && <ChevronRight size={11} className={`shrink-0 transition-colors ${isActive ? 'text-primary-500' : 'text-secondary-300'}`} />}
            </div>
          );
        })}
        <Link to="/categories" className="flex items-center gap-2 px-3 py-2.5 text-xs text-primary-600 font-semibold border-t border-secondary-100 hover:bg-primary-50 transition-colors">
          <Package size={14} /> View All Categories
        </Link>
      </nav>

      {/* Level 2 flyout panel */}
      {hoveredId && activeChildren.length > 0 && activeCat && (
        <div
          className="absolute left-full top-0 z-[200] bg-white border border-secondary-200 shadow-2xl rounded-r-xl overflow-hidden flex"
          style={{ minHeight: '100%', minWidth: 220 }}
          onMouseEnter={() => clearTimeout(leaveTimer.current)}
          onMouseLeave={leave}
        >
          {/* L2 list */}
          <div className="w-52 shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 bg-primary-50 border-b border-primary-100">
              <span className="text-sm font-bold text-primary-700">{activeCat.name}</span>
              <Link to={`/category/${activeCat.slug}`} className="text-xs text-primary-600 font-semibold hover:underline flex items-center gap-0.5">
                All <ChevronRight size={11} />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {activeChildren.map(sub => {
                const hasSubs = !!(childrenMap[sub._id]?.length);
                const isSubActive = hoveredSubId === sub._id;
                return (
                  <div
                    key={sub._id}
                    onMouseEnter={() => enterL2(sub._id)}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                      isSubActive ? 'bg-primary-50 text-primary-600' : 'text-secondary-700 hover:bg-secondary-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 overflow-hidden transition-colors ${isSubActive ? 'bg-primary-100 text-primary-600' : 'bg-secondary-100 text-secondary-400'}`}>
                      {sub.image
                        ? <img src={normalizeImageUrl(sub.image)} alt="" className="w-full h-full object-contain p-1" onError={(e) => { e.target.style.display='none'; }} />
                        : <CatIcon cat={sub} size={13} />
                      }
                    </div>
                    <Link to={`/category/${sub.slug}`} className="text-xs font-medium flex-1 leading-tight" onClick={(e) => hasSubs && e.preventDefault()}>
                      {sub.name}
                    </Link>
                    {hasSubs
                      ? <ChevronRight size={11} className={`shrink-0 ${isSubActive ? 'text-primary-500' : 'text-secondary-300'}`} />
                      : null
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* L3 panel — shown when hovering a L2 item that has children */}
          {hoveredSubId && activeGrandChildren.length > 0 && activeSubCat && (
            <div
              className="w-52 border-l border-secondary-100 flex flex-col"
              onMouseEnter={() => enterL2(hoveredSubId)}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary-50 border-b border-secondary-100">
                <span className="text-xs font-bold text-secondary-700">{activeSubCat.name}</span>
                <Link to={`/category/${activeSubCat.slug}`} className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
                  All <ChevronRight size={10} />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {activeGrandChildren.map(gc => (
                  <Link
                    key={gc._id}
                    to={`/category/${gc.slug}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-secondary-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-secondary-100 flex items-center justify-center shrink-0 text-secondary-400 overflow-hidden">
                      {gc.image
                        ? <img src={normalizeImageUrl(gc.image)} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { e.target.style.display='none'; }} />
                        : <CatIcon cat={gc} size={12} />
                      }
                    </div>
                    <span className="leading-tight">{gc.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Default export ───────────────────────────────────────────────────── */
export default function CategorySidebar({ categories, sticky = false }) {
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

  if (sticky) {
    return <StickyNav parents={parents} childrenMap={childrenMap} />;
  }

  return (
    <>
      {/* Desktop: left + right panel */}
      <div className="hidden md:flex" style={{ minHeight: 300 }}>
        <div className="w-44 bg-secondary-50 border-r border-secondary-200 shrink-0">
          {parents.map(cat => {
            const isActive = cat._id === activeId;
            const hasChildren = !!(childrenMap[cat._id]?.length);
            return (
              <div
                key={cat._id}
                onMouseEnter={() => setHoveredId(cat._id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                  isActive ? 'bg-white border-r-2 border-primary-500 text-primary-600' : 'text-secondary-700 hover:bg-white'
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

        <div className="flex-1 px-4 py-3 bg-white">
          {activeCat && (
            <>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-secondary-100">
                <h3 className="text-sm font-bold text-secondary-800">{activeCat.name}</h3>
                <Link to={`/category/${activeCat.slug}`} className="text-xs text-primary-600 font-semibold flex items-center gap-0.5 hover:text-primary-700">
                  View all <ChevronRight size={11} />
                </Link>
              </div>
              {activeChildren.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {activeChildren.map(sub => (
                    <Link key={sub._id} to={`/category/${sub.slug}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary-50 group transition-colors">
                      <div className="w-8 h-8 rounded bg-secondary-100 group-hover:bg-primary-100 flex items-center justify-center shrink-0 text-secondary-500 group-hover:text-primary-500 transition-colors">
                        <CatIcon cat={sub} size={15} />
                      </div>
                      <span className="text-xs font-medium text-secondary-700 group-hover:text-primary-600 leading-tight">{sub.name}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Link to={`/category/${activeCat.slug}`} className="inline-flex items-center gap-1 text-sm text-primary-600 font-semibold hover:underline mt-2">
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
                : <ChevronRight size={15} className="text-secondary-400 shrink-0" />}
            </>
          );
          return (
            <div key={cat._id}>
              {children.length > 0 ? (
                <button onClick={() => setOpenId(isOpen ? null : cat._id)} className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-secondary-50 transition-colors">
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
                    <Link key={sub._id} to={`/category/${sub.slug}`} className="flex items-center gap-2 p-2 rounded bg-white hover:bg-primary-50 transition-colors group">
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
