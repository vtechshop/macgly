import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks';
import { setMeta } from '../../utils/seo';
import Spinner from '../components/common/Spinner';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }

export default function Blog() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setMeta({
      title: 'Blog — Tools, Tips & Industry News | Macgly',
      description: 'Expert guides, tool reviews and industry news from Macgly. Learn about power tools, machines, spare parts and more.',
      canonical: 'https://macgly.com/blog',
    });
  }, []);

  const { data, isLoading } = useFetch(
    ['blog', search, page],
    () => api.get('/blog', { params: { search: search || undefined, page, limit: 12 } }).then((r) => r.data)
  );

  const posts = data?.posts || [];
  const pagination = data?.pagination || {};

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-secondary-900 mb-3">Macgly Blog</h1>
        <p className="text-secondary-500 text-lg">Tips, guides, and news about tools & machinery</p>
      </div>

      <div className="relative max-w-md mx-auto mb-10">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input w-full pl-9"
          placeholder="Search articles…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-secondary-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No articles found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post._id} to={`/blog/${post.slug}`} className="card overflow-hidden hover:shadow-md transition-shadow group">
                {post.coverImage && (
                  <div className="aspect-video overflow-hidden">
                    <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-4">
                  {post.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded-full font-medium">{tag}</span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-bold text-secondary-900 line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">{post.title}</h2>
                  {post.excerpt && <p className="text-sm text-secondary-500 line-clamp-2 mb-3">{post.excerpt}</p>}
                  <div className="flex items-center gap-2 text-xs text-secondary-400">
                    {post.author?.name && <span>{post.author.name}</span>}
                    {post.author?.name && <span>·</span>}
                    <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn disabled:opacity-40">← Previous</button>
              <span className="text-sm text-secondary-500">Page {pagination.page} of {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
