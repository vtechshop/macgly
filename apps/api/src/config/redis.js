const { REDIS_URL } = require('./env');

let redisClient = null;

async function connectRedis() {
  if (!REDIS_URL) {
    console.log('Redis URL not set — using in-memory cache fallback');
    return null;
  }
  const { default: Redis } = await import('ioredis');
  redisClient = new Redis(REDIS_URL);
  redisClient.on('connect', () => console.log('Redis connected'));
  redisClient.on('error', (err) => console.error('Redis error:', err.message));
  return redisClient;
}

function getRedis() {
  return redisClient;
}

module.exports = { connectRedis, getRedis };
