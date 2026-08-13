const { MongoMemoryReplSet } = require('mongodb-memory-server');

let mongod;

module.exports = async function () {
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_JOBS = 'true';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  process.env.JWT_ACCESS_EXPIRES = '15m';
  process.env.JWT_REFRESH_EXPIRES = '7d';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_1234';

  // Use a single-node replica set so integration tests can use MongoDB sessions
  // and multi-document transactions (required for MEDIUM 7 order atomicity).
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongod.waitUntilRunning();
  process.env.MONGO_URI = mongod.getUri();
  // Expose for teardown
  global.__MONGOD__ = mongod;
};
