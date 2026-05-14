// GST rates by category (extendable via AppConfig)
const DEFAULT_RATES = {
  tools: 18,
  machinery: 18,
  electrical: 18,
  hardware: 18,
  safety: 18,
  default: 18,
};

function getRate(category) {
  return DEFAULT_RATES[category?.toLowerCase()] ?? DEFAULT_RATES.default;
}

function calculate(amount, rate) {
  const gst = (amount * rate) / 100;
  return {
    baseAmount: parseFloat(amount.toFixed(2)),
    gstRate: rate,
    gstAmount: parseFloat(gst.toFixed(2)),
    totalAmount: parseFloat((amount + gst).toFixed(2)),
    cgst: parseFloat((gst / 2).toFixed(2)),
    sgst: parseFloat((gst / 2).toFixed(2)),
    igst: 0,
  };
}

function calculateOrder(items) {
  let totalGst = 0;
  const breakdown = items.map((item) => {
    const rate = getRate(item.category);
    const saleAmount = item.price * item.quantity;
    const gst = (saleAmount * rate) / 100;
    totalGst += gst;
    return { ...item, gstRate: rate, gstAmount: parseFloat(gst.toFixed(2)) };
  });
  return { breakdown, totalGst: parseFloat(totalGst.toFixed(2)) };
}

module.exports = { getRate, calculate, calculateOrder };
