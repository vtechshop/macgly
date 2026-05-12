const { getCache, setCache, deleteCache } = require('../utils/cache');

function cacheMiddleware(ttl) {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    try {
      const cached = await getCache(key);
      if (cached) return res.json(cached);
    } catch {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = function (data) {
      res.json = originalJson;
      // fire-and-forget — never block the response
      setCache(key, data, ttl).catch(() => {});
      return originalJson(data);
    };
    next();
  };
}

async function invalidateCache(pattern) {
  await deleteCache(pattern);
}

module.exports = { cacheMiddleware, invalidateCache };
