import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;
console.log('process.env -> ', process.env);

export const connectDB = async () => {
  try {
    console.log('mongoUri --> ', mongoUri);
    await mongoose.connect(mongoUri);
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
