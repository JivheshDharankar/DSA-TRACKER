import mongoose from 'mongoose';
import { env } from './env.js';

const connectionStates: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const getDatabaseStatus = () => {
  const stateCode = mongoose.connection.readyState;
  return {
    connected: stateCode === 1,
    state: connectionStates[stateCode] ?? 'unknown',
  };
};

export const connectDatabase = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB connection lost. Reconnecting...');
    });

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB on startup:', error);
    // In development, log the error without immediately terminating so the HTTP server can still serve health check
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed');
  }
};
