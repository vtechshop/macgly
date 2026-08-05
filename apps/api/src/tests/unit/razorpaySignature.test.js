const crypto = require('crypto');
const { isValidPaymentSignature } = require('../../utils/razorpaySignature');

const SECRET = 'test_key_secret';
const ORDER = 'order_ABC123';
const PAYMENT = 'pay_XYZ789';

function sign(orderId, paymentId, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('isValidPaymentSignature', () => {
  it('accepts a signature produced with the correct secret', () => {
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, PAYMENT), secret: SECRET,
    })).toBe(true);
  });

  it('accepts an uppercase hex signature', () => {
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, PAYMENT).toUpperCase(), secret: SECRET,
    })).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, PAYMENT, 'wrong_secret'), secret: SECRET,
    })).toBe(false);
  });

  it('rejects a signature bound to a different order', () => {
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign('order_OTHER', PAYMENT), secret: SECRET,
    })).toBe(false);
  });

  it('rejects a signature bound to a different payment', () => {
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, 'pay_OTHER'), secret: SECRET,
    })).toBe(false);
  });

  it('rejects a swapped order/payment pair', () => {
    expect(isValidPaymentSignature({
      orderId: PAYMENT, paymentId: ORDER, signature: sign(ORDER, PAYMENT), secret: SECRET,
    })).toBe(false);
  });

  it.each([
    ['empty string', ''],
    ['non-hex of correct length', 'z'.repeat(64)],
    ['too short', 'a'.repeat(63)],
    ['too long', 'a'.repeat(65)],
    ['null', null],
    ['undefined', undefined],
    ['number', 12345],
    ['object', {}],
    ['buffer', Buffer.alloc(32)],
  ])('rejects a %s signature without throwing', (_label, signature) => {
    expect(() => isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature, secret: SECRET,
    })).not.toThrow();
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature, secret: SECRET,
    })).toBe(false);
  });

  // Two non-hex strings both decode to an empty Buffer, which timingSafeEqual
  // would report as equal. The hex format guard must catch this first.
  it('does not treat two undecodable hex strings as a match', () => {
    expect(isValidPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: 'zz', secret: 'zz',
    })).toBe(false);
  });

  it.each([
    ['missing orderId', { paymentId: PAYMENT, secret: SECRET }],
    ['missing paymentId', { orderId: ORDER, secret: SECRET }],
    ['missing secret', { orderId: ORDER, paymentId: PAYMENT }],
  ])('rejects when %s', (_label, partial) => {
    expect(isValidPaymentSignature({ ...partial, signature: sign(ORDER, PAYMENT) })).toBe(false);
  });
});
