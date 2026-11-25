// Indian phone numbers: exactly 10 digits. Accepts the forms people type —
// "98765 43210", "+91 98765 43210", "098765-43210" — and returns the bare
// 10 digits, or null when it is not a valid 10-digit number.
function normalizeIndianPhone(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

module.exports = { normalizeIndianPhone };
