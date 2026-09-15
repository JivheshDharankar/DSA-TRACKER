import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';

const startServer = async () => {
  const app = createApp();

  // Attempt database connection
  await connectDatabase();

  // Seed patterns idempotently
  try {
    const { seedPatterns } = await import('./seeds/patterns.seed.js');
    await seedPatterns();
  } catch (err) {
    console.error('Failed to seed patterns on startup:', err);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 DSA Tracker Backend API running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`📡 Health check available at: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`🔒 Allowed CORS Client Origin: ${env.CLIENT_URL}`);
  });

  // Graceful shutdown signals
  const shutdown = () => {
    console.log('\n🛑 Gracefully shutting down DSA Tracker API...');
    server.close(async () => {
      console.log('✅ HTTP server closed');
      try {
        const mongoose = (await import('mongoose')).default;
        await mongoose.disconnect();
        console.log('✅ MongoDB connection cleanly closed');
      } catch (err) {
        console.error('Error closing MongoDB connection:', err);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
