const request = require('supertest');
const { connectDB, disconnectDB, clearDB, registerUser, app } = require('./helpers');
const Product = require('../../models/Product');
const Cart = require('../../models/Cart');

const SESSION_COOKIE_RE = /(^|;\s*)sessionId=([0-9a-f]{32})/;

/** Pulls the sessionId cookie value out of a Set-Cookie header array. */
function sessionIdFrom(res) {
  const header = res.headers['set-cookie'] || [];
  for (const c of header) {
    const m = c.match(SESSION_COOKIE_RE);
    if (m) return m[2];
  }
  return null;
}

async function makeProduct(overrides = {}) {
  return Product.create({
    title: 'Angle Grinder 4 Inch',
    description: 'Test product',
    price: 2500,
    stock: 50,
    published: true,
    ...overrides,
  });
}

describe('Cart session isolation (P0-01)', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  describe('guest sessions', () => {
    it('issues a unique 128-bit session cookie to each new visitor', async () => {
      const a = await request(app).get('/api/cart');
      const b = await request(app).get('/api/cart');

      const sidA = sessionIdFrom(a);
      const sidB = sessionIdFrom(b);

      expect(sidA).toMatch(/^[0-9a-f]{32}$/);
      expect(sidB).toMatch(/^[0-9a-f]{32}$/);
      expect(sidA).not.toBe(sidB);
    });

    it('marks the session cookie httpOnly, lax and long-lived', async () => {
      const res = await request(app).get('/api/cart');
      const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('sessionId='));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//i);
    });

    it('does NOT leak one guest cart into another guest browser', async () => {
      const product = await makeProduct();

      // Guest A adds an item
      const agentA = request.agent(app);
      await agentA.get('/api/cart');
      const addA = await agentA.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 2 });
      expect(addA.status).toBe(200);
      expect(addA.body.cart.items).toHaveLength(1);

      // Guest B is a different browser and must see nothing
      const agentB = request.agent(app);
      const cartB = await agentB.get('/api/cart');
      expect(cartB.status).toBe(200);
      expect(cartB.body.cart.items).toHaveLength(0);
    });

    it('never creates a cart owned by the literal string "anon"', async () => {
      const product = await makeProduct();
      const agent = request.agent(app);
      await agent.get('/api/cart');
      await agent.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 1 });

      expect(await Cart.countDocuments({ sessionId: 'anon' })).toBe(0);
      const carts = await Cart.find({ user: { $exists: false } }).lean();
      expect(carts).toHaveLength(1);
      expect(carts[0].sessionId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('ignores a forged non-hex sessionId cookie and issues a fresh one', async () => {
      const res = await request(app).get('/api/cart').set('Cookie', 'sessionId=anon');
      expect(sessionIdFrom(res)).toMatch(/^[0-9a-f]{32}$/);
    });

    it('keeps the same cart across requests from the same browser', async () => {
      const product = await makeProduct();
      const agent = request.agent(app);
      await agent.get('/api/cart');
      await agent.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 1 });

      const second = await agent.get('/api/cart');
      expect(second.body.cart.items).toHaveLength(1);
      expect(second.body.cart.items[0].quantity).toBe(1);
    });
  });

  describe('guest → user migration', () => {
    it('claims the guest cart when the user has no cart yet', async () => {
      const product = await makeProduct();
      const agent = request.agent(app);

      await agent.get('/api/cart');
      await agent.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 3 });

      const reg = await agent.post('/api/auth/register').send({
        name: 'Buyer', email: `buyer_${Date.now()}@example.com`, password: 'password123',
      });
      expect(reg.status).toBe(201);

      const after = await agent.get('/api/cart');
      expect(after.body.cart.items).toHaveLength(1);
      expect(after.body.cart.items[0].quantity).toBe(3);

      // Exactly one cart, now owned by the user
      expect(await Cart.countDocuments({})).toBe(1);
      const cart = await Cart.findOne({}).lean();
      expect(cart.user).toBeDefined();
      expect(cart.sessionId).toBeUndefined();
    });

    it('merges quantities when the user already has a cart', async () => {
      const product = await makeProduct();
      const email = `merge_${Date.now()}@example.com`;

      // Session 1: user signs up and adds 2
      const first = request.agent(app);
      await first.get('/api/cart');
      await first.post('/api/auth/register').send({ name: 'Buyer', email, password: 'password123' });
      await first.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 2 });

      // Session 2: same person on a different browser, adds 4 as a guest, then logs in
      const second = request.agent(app);
      await second.get('/api/cart');
      await second.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 4 });
      const login = await second.post('/api/auth/login').send({ email, password: 'password123' });
      expect(login.status).toBe(200);

      const after = await second.get('/api/cart');
      expect(after.body.cart.items).toHaveLength(1);
      expect(after.body.cart.items[0].quantity).toBe(6); // 2 + 4

      // Guest cart is gone; only the user cart remains
      expect(await Cart.countDocuments({})).toBe(1);
      expect(await Cart.countDocuments({ sessionId: { $exists: true } })).toBe(0);
    });

    it('only merges the guest cart belonging to the logging-in browser', async () => {
      const product = await makeProduct();
      const email = `scoped_${Date.now()}@example.com`;

      // A bystander guest builds their own cart
      const bystander = request.agent(app);
      await bystander.get('/api/cart');
      await bystander.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 7 });

      // Our buyer registers in a clean browser with an empty guest session
      const buyer = request.agent(app);
      await buyer.get('/api/cart');
      await buyer.post('/api/auth/register').send({ name: 'Buyer', email, password: 'password123' });

      const buyerCart = await buyer.get('/api/cart');
      expect(buyerCart.body.cart.items).toHaveLength(0);

      // The bystander still owns their untouched cart
      const bystanderCart = await bystander.get('/api/cart');
      expect(bystanderCart.body.cart.items).toHaveLength(1);
      expect(bystanderCart.body.cart.items[0].quantity).toBe(7);
    });

    it('is idempotent — repeated cart reads after login do not duplicate quantities', async () => {
      const product = await makeProduct();
      const email = `idem_${Date.now()}@example.com`;

      const agent = request.agent(app);
      await agent.get('/api/cart');
      await agent.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 5 });
      await agent.post('/api/auth/register').send({ name: 'Buyer', email, password: 'password123' });

      await agent.get('/api/cart');
      await agent.get('/api/cart');
      const third = await agent.get('/api/cart');

      expect(third.body.cart.items).toHaveLength(1);
      expect(third.body.cart.items[0].quantity).toBe(5);
      expect(await Cart.countDocuments({})).toBe(1);
    });

    it('survives concurrent post-login cart reads without duplicating the merge', async () => {
      const product = await makeProduct();
      const email = `race_${Date.now()}@example.com`;

      const agent = request.agent(app);
      await agent.get('/api/cart');
      await agent.post('/api/cart/items').send({ productId: product._id.toString(), quantity: 2 });
      await agent.post('/api/auth/register').send({ name: 'Buyer', email, password: 'password123' });

      const results = await Promise.all([
        agent.get('/api/cart'), agent.get('/api/cart'),
        agent.get('/api/cart'), agent.get('/api/cart'),
      ]);
      results.forEach((r) => expect(r.status).toBe(200));

      const carts = await Cart.find({}).lean();
      expect(carts).toHaveLength(1);
      expect(carts[0].items).toHaveLength(1);
      expect(carts[0].items[0].quantity).toBe(2);
    });
  });

  describe('logout', () => {
    it('clears the cart session so a shared browser starts clean', async () => {
      const { cookies } = await registerUser({ email: `logout_${Date.now()}@example.com` });
      const res = await request(app).post('/api/auth/logout').set('Cookie', cookies);
      const cleared = (res.headers['set-cookie'] || []).find((c) => c.startsWith('sessionId='));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/sessionId=;/);
    });
  });
});
