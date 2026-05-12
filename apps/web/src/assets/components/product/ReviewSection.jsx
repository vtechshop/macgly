import { useState } from 'react';
import { Star, ThumbsUp, ShoppingBag } from 'lucide-react';
import { useSelector } from 'react-redux';
import api from '../../../utils/api';
import { useFetch, useAction } from '../../../hooks';
import { formatRelativeTime } from '../../../utils/format';
import Button from '../common/Button';
import toast from 'react-hot-toast';

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Star size={24} className={n <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200'} />
        </button>
      ))}
    </div>
  );
}

export default function ReviewSection({ productId }) {
  const { user } = useSelector((s) => s.auth);
  const [rev, setRev] = useState(0);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading } = useFetch(
    ['reviews', productId, rev],
    () => api.get(`/reviews/product/${productId}`).then((r) => r.data)
  );

  const { mutate: submit, isPending } = useAction(
    () => api.post('/reviews', { productId, rating, title, body }),
    {
      onSuccess: () => {
        setRev((r) => r + 1);
        setRating(0); setTitle(''); setBody('');
        toast.success('Review submitted!');
      },
      onError: (err) => {
        toast.error(err.response?.data?.error?.message || 'Could not submit review');
      },
    }
  );

  const reviews = data?.reviews || [];
  const hasReviewed = data?.hasReviewed || false;
  const hasPurchased = data?.hasPurchased || false;

  function renderForm() {
    if (!user) {
      return (
        <p className="text-sm text-secondary-500 mb-6">
          <a href="/login" className="text-primary-600 font-medium hover:underline">Sign in</a> to write a review
        </p>
      );
    }
    if (hasReviewed) {
      return (
        <div className="card p-4 mb-6 bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2">
          <Star size={15} className="fill-green-500 text-green-500" />
          You have already reviewed this product. Thank you!
        </div>
      );
    }
    if (!hasPurchased) {
      return (
        <div className="card p-5 mb-6 bg-secondary-50 border border-secondary-200 flex items-center gap-3">
          <ShoppingBag size={20} className="text-secondary-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-secondary-700">Purchase required to review</p>
            <p className="text-xs text-secondary-500 mt-0.5">Only customers who have received this product can leave a review.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-3">Write a Review</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-secondary-600 mb-1">Your Rating *</p>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <input
            className="input"
            placeholder="Review title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input h-24 resize-none"
            placeholder="Share your experience with this product..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button
            onClick={() => {
              if (!rating) { toast.error('Please select a rating'); return; }
              submit().catch(() => {});
            }}
            loading={isPending}
            disabled={isPending}
          >
            Submit Review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 border-t border-secondary-200 pt-8">
      <h2 className="text-xl font-bold mb-6">Customer Reviews</h2>

      {renderForm()}

      {isLoading ? (
        <p className="text-secondary-400 text-sm">Loading reviews...</p>
      ) : !reviews.length ? (
        <div className="text-center py-8 text-secondary-400">
          <ThumbsUp size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No reviews yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r._id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} size={14} className={n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200 fill-secondary-200'} />
                      ))}
                    </div>
                    {r.verified && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Verified Purchase</span>
                    )}
                  </div>
                  {r.title && <p className="font-semibold text-sm">{r.title}</p>}
                  <p className="text-sm text-secondary-600 mt-1 leading-relaxed">{r.body || <span className="italic text-secondary-400">No written review</span>}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-secondary-700">{r.user?.name}</p>
                  <p className="text-xs text-secondary-400">{formatRelativeTime(r.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
