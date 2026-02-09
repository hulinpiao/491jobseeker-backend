import mongoose from 'mongoose';

const COLLECTION_NAME = '2026_02_07';

export async function connectDatabase(): Promise<void> {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unified_jobs';
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export function disconnectDatabase(): Promise<void> {
  return mongoose.disconnect();
}

export { COLLECTION_NAME };
