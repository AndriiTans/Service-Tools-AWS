import { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const s3 = new S3Client({ region: process.env.AWS_REGION });

const generateS3BucketBulkUrls = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileDataArray } = req.body;

    const bucketName = process.env.S3_BUCKET_NAME;

    const signedBulkUrlsResponse = await Promise.all(
      fileDataArray.map(async (fileData) => {
        const { fileName, contentType } = fileData;

        const fileExtension = fileName.split('.').pop();
        const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(`.${fileExtension}`, '');
        const uniqueId = uuidv4();
        const key = `uploads/${sanitizedFileName}-${uniqueId}.${fileExtension}`;

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          ContentType: contentType,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return { key, url };
      }),
    );

    res.status(200).json({
      uploadUrls: signedBulkUrlsResponse,
      bucketName,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ message: 'Failed to generate upload URL', error });
  }
};

export default generateS3BucketBulkUrls;
