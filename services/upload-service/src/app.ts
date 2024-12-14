import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import logger from './utils/logger';
import getS3BucketBulkUrls from './handlers/getS3BucketBulkUrls';

dotenv.config();

const app = express();

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger);

app.post('/generate-upload-urls', getS3BucketBulkUrls);

app.get('/health', (req: Request, res: Response) => {
  console.log('req.Me', req.method, req.path);
  res.send('Hello from Upload service!');
});

app.get('/env', (req: Request, res: Response) => {
  res.json(process.env);
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
