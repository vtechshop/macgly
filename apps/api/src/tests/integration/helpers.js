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
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
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
