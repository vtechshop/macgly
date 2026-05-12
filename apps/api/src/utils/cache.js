const { getRedis } = require('../config/redis');

const memoryStore = new Map();

async function getCache(key) {
  const redis = getRedis();
  if (redis) {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function setCache(key, value, ttlSeconds = 300) {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return;
  }
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function deleteCache(pattern) {
  const redis = getRedis();
  if (redis) {
    const keys = await redis.keys(pattern.replace('*', '*'));
    if (keys.length) await redis.del(...keys);
    return;
  }
  const prefix = pattern.replace('*', '');
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

module.exports = { getCache, setCache, deleteCache };
