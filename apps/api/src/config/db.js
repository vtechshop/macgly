const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

async function connectDB() {
  await mongoose.connect(MONGO_URI, {
    maxPoolSize: 20,      // concurrent DB connections
    minPoolSize: 2,       // keep warm connections ready
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
  });
  console.log('MongoDB connected');
}

module.exports = connectDB;
