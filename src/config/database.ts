import mongoose from 'mongoose';

const COLLECTION_NAME = '2026_02_07';

// Export MONGODB_URI for use in other modules
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unified_jobs';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

export { COLLECTION_NAME };
