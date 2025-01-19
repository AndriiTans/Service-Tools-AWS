import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import logger from './utils/logger';
import {
  deleteMessagesByFileName,
  getAllUserMessagesByFilename,
  getAllUserMessagesInAllFiles,
  getParsedContent,
  getUniqueFilenames,
} from './handlers/contentHandler';
import { connectDB } from './config/db';

dotenv.config();

const app = express();

connectDB()
  .then(() => {
    console.log('Database connection initialized');
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error);
    process.exit(1); // Exit if DB connection fails
  });

/// CORS Configuration
const corsOptions = {
  // origin: process.env.FRONTEND_URL || '*', // Replace with your frontend URL in production
  origin: '*', // Replace with your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Include necessary headers
  credentials: true, // Allow cookies and Authorization headers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicitly handle preflight requests
app.options('*', (req, res) => {
  // res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});
// app.use(cors());
////

/// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger);

app.get('/get-all-filenames', getUniqueFilenames);

app.get('/get-parsed-content', getParsedContent);

app.delete('/delete-messages-by-filename', deleteMessagesByFileName);

app.get('/get-all-user-messages', getAllUserMessagesInAllFiles);

app.post('/get-user-messages-by-filename', getAllUserMessagesByFilename);

app.get('/health', (req: Request, res: Response) => {
  console.log('req.Method:', req.method, req.path);
  res.send('Hello from ContentFeed service!');
});

app.get('/env', (req: Request, res: Response) => {
  res.json(process.env);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message || err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
