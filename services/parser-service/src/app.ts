import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer'; // Import multer
import path from 'path';
import fs from 'fs';
import logger from './utils/logger';
import processSqsMessages from './handlers/processSqsMessages';
import parseHtml from './handlers/parseHtml';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger);

// Configure multer for file uploads

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads'); // Destination folder for uploaded files
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /html|txt|json|csv/; // Adjust allowed file types as needed
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type! Only HTML, TXT, JSON, and CSV are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // Set file size limit to 10MB
});

app.post('/parseHtml', upload.single('file'), parseHtml);

app.get('/health', (req: Request, res: Response) => {
  console.log('req.Method:', req.method, req.path);
  res.send('Hello from Parser service!');
});

app.get('/process-sqs', processSqsMessages);

app.get('/env', (req: Request, res: Response) => {
  res.json(process.env);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message || err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
