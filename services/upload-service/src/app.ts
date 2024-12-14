import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import logger from './utils/logger';
import getS3BucketBulkUrls from './handlers/getS3BucketBulkUrls';

dotenv.config();

const app = express();

app.use(cors());
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
