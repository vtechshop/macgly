import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks';
import Spinner from '../components/common/Spinner';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }

export default function BlogPost() {
  const { slug } = useParams();

  const { data, isLoading } = useFetch(
    ['blog-post', slug],
    () => api.get(`/blog/${slug}`).then((r) => r.data)
  );

  const post = data?.post;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!post) return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center text-secondary-400">
      <p className="font-medium text-lg">Post not found</p>
      <Link to="/blog" className="btn-primary mt-4 inline-block">Back to Blog</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/blog" className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium mb-6">
        <ArrowLeft size={16} /> Back to Blog
      </Link>

      {post.coverImage && (
        <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-600 text-xs rounded-full font-medium">
              <Tag size={10} /> {tag}
            </span>
          ))}
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-4 leading-tight">{post.title}</h1>

      <div className="flex items-center gap-4 text-sm text-secondary-400 mb-8 pb-8 border-b border-secondary-100">
        {post.author?.name && (
          <span className="flex items-center gap-1.5"><User size={13} /> {post.author.name}</span>
        )}
        <span className="flex items-center gap-1.5"><Calendar size={13} /> {fmtDate(post.publishedAt || post.createdAt)}</span>
      </div>

      {post.excerpt && (
        <p className="text-lg text-secondary-600 font-medium mb-6 leading-relaxed">{post.excerpt}</p>
      )}

      <div
        className="prose prose-secondary max-w-none text-secondary-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </div>
  );
}
