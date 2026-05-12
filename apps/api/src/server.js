const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { PORT } = require('./config/env');

async function start() {
  await connectDB();
  await connectRedis();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
