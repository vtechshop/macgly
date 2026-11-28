// IndexNow: tells Bing (which feeds ChatGPT search), Yandex, Seznam etc. the
// moment a public page is added, changed or removed, instead of waiting for
// them to recrawl the sitemap.
//
// The key is public by design: search engines verify it by fetching
// https://www.macgly.com/<key>.txt (apps/web/public/). Changing it means
// renaming that file too.

const KEY = process.env.INDEXNOW_KEY || '5f5b3156ca4875dc7c3b90cc0704c994';
const HOST = 'www.macgly.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const FLUSH_DELAY_MS = 10_000;          // batch a burst of edits into one request
const RESUBMIT_AFTER_MS = 60 * 60_000;  // don't resend the same URL within an hour
const MAX_URLS_PER_REQUEST = 10_000;    // protocol limit

const pending = new Set();
const lastSent = new Map();
let timer = null;

function isEnabled() {
  if (process.env.INDEXNOW_ENABLED === 'true') return true;
  if (process.env.INDEXNOW_ENABLED === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

/** Queue site paths such as "/product/abc" for submission. */
function queuePaths(paths) {
  if (!isEnabled()) return;
  const now = Date.now();
  for (const p of paths) {
    if (!p) continue;
    const url = `https://${HOST}${p}`;
    if (now - (lastSent.get(url) || 0) < RESUBMIT_AFTER_MS) continue;
    pending.add(url);
  }
  if (pending.size && !timer) {
    timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, FLUSH_DELAY_MS);
    timer.unref?.();
  }
}

async function flush() {
  if (!pending.size || typeof fetch !== 'function') return;
  const urlList = [...pending].slice(0, MAX_URLS_PER_REQUEST);
  urlList.forEach((u) => pending.delete(u));
  const now = Date.now();
  urlList.forEach((u) => lastSent.set(u, now));
  if (lastSent.size > 50_000) {
    for (const [u, t] of lastSent) if (now - t >= RESUBMIT_AFTER_MS) lastSent.delete(u);
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.warn(`[IndexNow] ${res.status} for ${urlList.length} URL(s)`);
  } catch (err) {
    console.warn('[IndexNow] submit failed:', err.message);
  }
  if (pending.size) queuePaths([]); // more than one batch's worth — schedule the rest
}

/**
 * Mongoose plugin: queue a document's public URL whenever it is created,
 * updated, published, unpublished or deleted.
 *   pathFor(doc)  → "/product/<slug>"
 *   isPublic(doc) → whether that URL is live on the site
 *   visibility    → fields whose change means the page appeared/disappeared
 */
function indexNowPlugin(schema, { pathFor, isPublic, visibility }) {
  const select = ['slug', ...visibility].join(' ');
  const touchesVisibility = (update = {}) =>
    visibility.some((f) => f in update || f in (update.$set || {}) || f in (update.$unset || {}));

  // Look the docs up again after the write so we see their current state.
  // Not awaited: submission must never slow down or fail the request.
  const queueIds = (model, ids, force) => {
    if (!ids.length) return;
    model.find({ _id: { $in: ids } }).select(select).lean()
      .then((docs) => queuePaths(docs.filter((d) => force || isPublic(d)).map(pathFor)))
      .catch(() => {});
  };

  schema.pre('save', function () {
    // A new doc has every field "modified"; only an existing page can disappear.
    if (isEnabled()) this.$locals.indexNowForce = !this.isNew && visibility.some((f) => this.isModified(f));
  });
  schema.post('save', function (doc) {
    if (isEnabled() && (isPublic(doc) || doc.$locals.indexNowForce)) queuePaths([pathFor(doc)]);
  });

  schema.post(['findOneAndUpdate', 'updateOne'], async function (res) {
    if (!isEnabled()) return;
    const id = res?._id || res?.upsertedId;
    const found = id ? null : await this.model.findOne(this.getFilter()).select('_id').lean().catch(() => null);
    queueIds(this.model, id ? [id] : found ? [found._id] : [], touchesVisibility(this.getUpdate()));
  });

  // Bulk updates can change the fields their own filter matches on
  // (e.g. {published:false} → published:true), so capture the ids first.
  schema.pre('updateMany', async function () {
    if (isEnabled()) this._indexNowIds = await this.model.find(this.getFilter()).distinct('_id');
  });
  schema.post('updateMany', function () {
    if (isEnabled()) queueIds(this.model, this._indexNowIds || [], touchesVisibility(this.getUpdate()));
  });

  schema.post('findOneAndDelete', function (doc) {
    if (isEnabled() && doc && isPublic(doc)) queuePaths([pathFor(doc)]);
  });
  schema.pre(['deleteMany', 'deleteOne'], { document: false, query: true }, async function () {
    if (!isEnabled()) return;
    const docs = await this.model.find(this.getFilter()).select(select).lean();
    this._indexNowPaths = docs.filter(isPublic).map(pathFor);
  });
  schema.post(['deleteMany', 'deleteOne'], { document: false, query: true }, function () {
    if (isEnabled()) queuePaths(this._indexNowPaths || []);
  });
}

module.exports = {
  queuePaths, flush, indexNowPlugin, isEnabled, KEY,
  _reset: () => { pending.clear(); lastSent.clear(); clearTimeout(timer); timer = null; },
  _pending: () => [...pending],
};
