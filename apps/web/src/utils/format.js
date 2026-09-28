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
    const t = ['f_auto', 'q_auto', width ? `c_limit,w_${width}` : null].filter(Boolean).join(',');
    return url.replace('/upload/', `/upload/${t}/`);
  }
  return url;
}

/** srcset for Cloudinary images so the browser picks a size to fit the slot. */
// Capped at 480: phones (dpr ~2.6) would otherwise pick 640 for a ~180px tile.
export function imageSrcSet(url, widths = [200, 320, 480]) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/') || url.includes('f_auto')) return undefined;
  return widths.map((w) => `${normalizeImageUrl(url, { width: w })} ${w}w`).join(', ');
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
