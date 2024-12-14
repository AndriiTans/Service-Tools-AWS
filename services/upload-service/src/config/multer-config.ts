import multer from 'multer';

// Configure Multer to store files in memory
export const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory as Buffer
  limits: {
    fileSize: 5 * 1024 * 1024, // Set file size limit (e.g., 5 MB)
  },
});
