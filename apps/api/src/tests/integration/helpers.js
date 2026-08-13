const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');

// Connect to the in-memory MongoDB set up by globalSetup
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

async function disconnectDB() {
  // Do not disconnect the shared Mongoose connection between suites.
  // writeAuditLog() (audit.js) schedules AuditLog.create() via setImmediate.
  // Those callbacks can fire after the suite ends; if Mongoose is disconnected
  // at that point it re-enters "connecting" state (readyState=2), causing the
  // next suite's connectDB() to skip the mongoose.connect() call (it only
  // reconnects when readyState===0). The next suite then runs against a
  // connection that never resolves, and its own disconnectDB() times out
  // waiting for _waitForConnect. globalTeardown (teardown.js → mongod.stop())
  // owns the actual connection cleanup; --forceExit handles any remaining handles.
  await clearDB();
}

async function clearDB() {
  const cols = Object.values(mongoose.connection.collections);
  await Promise.all(cols.map((c) => c.deleteMany({})));
}

// Register a user and return { agent, user, cookies }
async function registerUser(data = {}) {
  const payload = {
    name: 'Test User',
    email: `test_${Date.now()}@example.com`,
    password: 'password123',
    ...data,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  const cookies = res.headers['set-cookie'];
  return { res, user: res.body.user, cookies };
}

// Log in a user and return cookies
async function loginUser(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { res, cookies: res.headers['set-cookie'], user: res.body.user };
}

module.exports = { connectDB, disconnectDB, clearDB, registerUser, loginUser, app };
