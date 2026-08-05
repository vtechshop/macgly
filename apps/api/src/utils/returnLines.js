const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const sameLine = (orderItem, requested) =>
  String(orderItem.product) === String(requested.product ?? requested.productId) &&
  String(orderItem.variantId || '') === String(requested.variantId || '');

/**
 * Turns a customer's requested return into lines backed by the order.
 *
 * Everything — price, variant, quantity ceiling — comes from the order snapshot,
 * never from the request. Only the choice of which lines to send back is the
 * customer's. Without this, a return recorded `order.totalAmount` regardless of
 * what was actually returned, so sending back one ₹100 item from a ₹50,000 order
 * created a ₹50,000 refund claim.
 *
 * An empty or unmatched request means a full return, which is the historical
 * behaviour and what the UI sends today.
 *
 * @param {object} order the buyer's order
 * @param {Array}  [requested] raw `items` from the request body
 * @returns {{returnItems: Array, refundAmount: number, isFullReturn: boolean}}
 */
function resolveReturnLines(order, requested) {
  const orderItems = order?.items || [];

  const fromOrderItem = (oi, quantity) => ({
    product: oi.product,
    variantId: oi.variantId || null,
    title: oi.title,
    quantity,
    price: oi.price,
  });

  const fullReturn = () => {
    const returnItems = orderItems.map((oi) => fromOrderItem(oi, oi.quantity));
    return {
      returnItems,
      // The whole order came back, so refund what the order was worth.
      refundAmount: round2(order?.totalAmount || 0),
      isFullReturn: true,
    };
  };

  if (!Array.isArray(requested) || !requested.length) return fullReturn();

  const returnItems = [];
  for (const req of requested) {
    const oi = orderItems.find((x) => sameLine(x, req));
    if (!oi) continue;                       // not on this order — ignore it
    if (returnItems.some((r) => sameLine(oi, r))) continue;  // no duplicate lines
    const qty = Math.min(
      Math.max(1, parseInt(req.quantity, 10) || 1),
      oi.quantity || 1,                      // never more than was bought
    );
    returnItems.push(fromOrderItem(oi, qty));
  }

  if (!returnItems.length) return fullReturn();

  // Every line matched at full quantity — treat as a full return so shipping and
  // any order-level discount are refunded too.
  const isFullReturn = returnItems.length === orderItems.length &&
    returnItems.every((r) => {
      const oi = orderItems.find((x) => sameLine(x, r));
      return oi && r.quantity === oi.quantity;
    });
  if (isFullReturn) return fullReturn();

  return {
    returnItems,
    refundAmount: round2(returnItems.reduce((s, r) => s + (r.price || 0) * (r.quantity || 0), 0)),
    isFullReturn: false,
  };
}

module.exports = { resolveReturnLines };
