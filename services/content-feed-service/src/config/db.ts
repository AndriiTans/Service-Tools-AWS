import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;
console.log('process.env -> ', process.env);

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    console.log('mongoUri --> ', mongoUri);
    const db = await mongoose.connect(mongoUri);
    isConnected = !!db.connection.readyState;
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};
