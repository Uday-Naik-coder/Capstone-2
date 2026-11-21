import mongoose from 'mongoose';

import { env } from './env.js';

const STATE = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function dbState() {
  return STATE[mongoose.connection.readyState] || 'unknown';
}

export async function connectDb(uri = env.mongoUri) {
  if (!uri) {
    return { connected: false, reason: 'MONGODB_URI not set' };
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return { connected: true };
}

export async function disconnectDb() {
  await mongoose.disconnect().catch(() => {});
}