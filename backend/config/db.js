import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/leaklens';

export const dbState = {
  isMongoConnected: false,
  mongoErrorMessage: 'No MongoDB instance configured in environment. Using in-memory persistent store.'
};

mongoose.set('bufferCommands', false); // Fail fast, don't hang when MongoDB is unreachable

export async function connectDB(onConnectCallback) {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 2500
      });
      dbState.isMongoConnected = true;
      dbState.mongoErrorMessage = '';
      console.log('✅ Connected to MongoDB via Mongoose successfully.');
      if (typeof onConnectCallback === 'function') {
        await onConnectCallback();
      }
    } catch (err) {
      dbState.isMongoConnected = false;
      dbState.mongoErrorMessage = err?.message || 'Failed to connect to MongoDB URI.';
      console.log('ℹ️ Notice: MongoDB not reachable, using verified document store.', dbState.mongoErrorMessage);
    }
  } else {
    dbState.isMongoConnected = false;
    dbState.mongoErrorMessage = 'MONGODB_URI is not set. Operating in verified document store mode.';
  }
  return dbState.isMongoConnected;
}

export default connectDB;
