const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

module.exports = async function () {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  process.env.JWT_ACCESS_EXPIRES = '15m';
  process.env.JWT_REFRESH_EXPIRES = '7d';

  mongod = new MongoMemoryServer();
  await mongod.start();
  process.env.MONGO_URI = mongod.getUri();
  // Expose for teardown
  global.__MONGOD__ = mongod;
};
