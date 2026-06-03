import api from './api';

export function canReorder(order) {
  return !['cancelled', 'returned'].includes(order.status) && (order.items?.length ?? 0) > 0;
}

export async function reorderItems(order) {
  const results = { added: [], failed: [], outOfStock: [] };

  const productIds = [...new Set(order.items.map((i) => i.product).filter(Boolean))];

  // Batch fetch fresh product data for stock check
  let productMap = {};
  try {
    const { data } = await api.get('/products', { params: { ids: productIds.join(','), limit: productIds.length } });
    const products = data.products || data.data || [];
    products.forEach((p) => { productMap[p._id] = p; });
  } catch {
    // If batch fetch fails, proceed with original quantities
  }

  for (const item of order.items) {
    const productId = item.product;
    if (!productId) { results.failed.push(item.title || 'Unknown item'); continue; }

    const fresh = productMap[productId?.toString?.() ?? productId];

    if (fresh && fresh.stock <= 0) {
      results.outOfStock.push(item.title || 'Item');
      continue;
    }

    const qty = fresh ? Math.min(item.quantity, fresh.stock) : item.quantity;

    try {
      await api.post('/cart/items', { productId, quantity: qty });
      results.added.push({ title: item.title || 'Item', quantityAdjusted: qty !== item.quantity });
    } catch {
      results.failed.push(item.title || 'Item');
    }
  }

  return {
    success: results.added.length > 0,
    results,
    message: buildMessage(results),
  };
}

function buildMessage({ added, outOfStock, failed }) {
  const parts = [];
  if (added.length)      parts.push(`${added.length} item${added.length !== 1 ? 's' : ''} added to cart`);
  if (outOfStock.length) parts.push(`${outOfStock.length} out of stock`);
  if (failed.length)     parts.push(`${failed.length} unavailable`);
  return parts.join(' · ') || 'Nothing could be added';
}
