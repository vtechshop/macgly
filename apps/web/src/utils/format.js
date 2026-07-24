export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date, opts = {}) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...opts,
  }).format(new Date(date));
}

export function normalizeImageUrl(url, { width } = {}) {
  if (!url) return url;
  if (url.includes('localhost:') && url.includes('/uploads/')) {
    return url.substring(url.indexOf('/uploads/'));
  }
  // Auto-format (WebP/AVIF) + quality compression for Cloudinary URLs
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('f_auto')) {
    const t = ['f_auto', 'q_auto', width ? `w_${width}` : null].filter(Boolean).join(',');
    return url.replace('/upload/', `/upload/${t}/`);
  }
  return url;
}

export function formatRelativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
