process.env.INDEXNOW_ENABLED = 'true';

const { connectDB, disconnectDB, clearDB } = require('./helpers');
const indexNow = require('../../services/indexNowService');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Blog = require('../../models/Blog');

beforeAll(connectDB);
afterAll(async () => { indexNow._reset(); await disconnectDB(); delete process.env.INDEXNOW_ENABLED; });
beforeEach(() => indexNow._reset());
afterEach(clearDB);

// queueIds() looks docs up without awaiting; give it a moment.
const settle = () => new Promise((r) => setTimeout(r, 150));
const queued = async () => { await settle(); return indexNow._pending(); };
const U = (p) => `https://www.macgly.com${p}`;
let n = 0;
const product = (extra = {}) => Product.create({ title: 'Drill', description: 'A drill', slug: `drill-${++n}`, price: 100, ...extra });

describe('IndexNow submission', () => {
  test('queues a newly published product, not a draft', async () => {
    const live = await product({ published: true });
    await product({ published: false });
    expect(await queued()).toEqual([U(`/product/${live.slug}`)]);
  });

  test('queues a product when it is edited, published, or unpublished', async () => {
    const p = await product({ published: false });
    indexNow._reset();
    await Product.findByIdAndUpdate(p._id, { published: true });
    expect(await queued()).toEqual([U(`/product/${p.slug}`)]);

    indexNow._reset();
    await Product.findByIdAndUpdate(p._id, { $set: { published: false } });
    expect(await queued()).toEqual([U(`/product/${p.slug}`)]); // so Bing drops it

    indexNow._reset();
    await Product.findByIdAndUpdate(p._id, { price: 90 });
    expect(await queued()).toEqual([]); // still a draft — nothing public changed
  });

  test('bulk-publishing a vendor\'s products queues all of them', async () => {
    const a = await product({ published: false });
    const b = await product({ published: false });
    indexNow._reset();
    await Product.updateMany({ published: false }, { published: true });
    expect((await queued()).sort()).toEqual([U(`/product/${a.slug}`), U(`/product/${b.slug}`)].sort());
  });

  test('deleting a live product queues its URL; deleting a draft does not', async () => {
    const live = await product({ published: true });
    const draft = await product({ published: false });
    indexNow._reset();
    await Product.findByIdAndDelete(live._id);
    await Product.deleteMany({ _id: draft._id });
    expect(await queued()).toEqual([U(`/product/${live.slug}`)]);
  });

  test('does not resend the same URL within an hour', async () => {
    const p = await product({ published: true });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    await indexNow.flush();
    await Product.findByIdAndUpdate(p._id, { price: 80 });
    expect(await queued()).toEqual([]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ host: 'www.macgly.com', key: indexNow.KEY, urlList: [U(`/product/${p.slug}`)] });
    expect(body.keyLocation).toBe(`https://www.macgly.com/${indexNow.KEY}.txt`);
    fetchMock.mockRestore();
  });

  test('covers categories and blog posts', async () => {
    await Category.create({ name: 'Drills', slug: 'drills' });
    await Blog.create({ title: 'Guide', slug: 'drill-guide', content: 'x', status: 'published' });
    await Blog.create({ title: 'Draft', slug: 'draft-post', content: 'x' });
    expect((await queued()).sort()).toEqual([U('/blog/drill-guide'), U('/category/drills')]);
  });

  test('does nothing outside production', async () => {
    process.env.INDEXNOW_ENABLED = 'false';
    await product({ published: true });
    expect(await queued()).toEqual([]);
    process.env.INDEXNOW_ENABLED = 'true';
  });
});

test('the key file served by the website matches the key', () => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '../../../../web/public', `${indexNow.KEY}.txt`);
  expect(fs.readFileSync(file, 'utf8').trim()).toBe(indexNow.KEY);
});
