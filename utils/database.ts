import mongoose from 'mongoose';
import { getEnv } from './env.ts';

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    console.log('Database already connected');
    return;
  }

  try {
    const mongoUri = getEnv('MONGODB_URI');
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
    });

    isConnected = true;
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    throw error;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('✓ MongoDB disconnected');
  } catch (error) {
    console.error('✗ MongoDB disconnection failed:', error);
    throw error;
  }
}

export function isDBConnected() {
  return isConnected;
}
