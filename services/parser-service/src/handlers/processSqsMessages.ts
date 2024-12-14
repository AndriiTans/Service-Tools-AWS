import { Request, Response } from 'express';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import parseHtml from './parseHtml';
import { Readable } from 'stream';

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const queueName = process.env.AWS_SQS_QUEUE_NAME; // Use the queue name from environment variables

// Function to retrieve the QueueUrl if not provided
const getQueueUrl = async () => {
  if (process.env.SQS_QUEUE_URL) {
    return process.env.SQS_QUEUE_URL; // Return if already set in the environment
  }

  try {
    const command = new GetQueueUrlCommand({ QueueName: queueName });
    const response = await sqs.send(command);
    return response.QueueUrl;
  } catch (error) {
    console.error('Error fetching QueueUrl:', error);
    throw error;
  }
};

export const streamToString = async (stream: Readable): Promise<string> => {
  let content: string = '';
  const CHECKED_KEY = 'linear_conversation';
  const AFTER_CONTENT_KEY = ',"has_user_editable_context":';
  let iterationCheckedKey = 0;
  let finished = false;
  let openSymbols = 0;

  let savingStarted = false;
  let savingFinished = false;

  for await (const bufferChunk of stream) {
    let chunk = bufferChunk.toString('utf-8');
    let i = 0;

    while (i < chunk.length) {
      if (!finished) {
        if (CHECKED_KEY[iterationCheckedKey] === chunk[i]) {
          iterationCheckedKey++;
        } else {
          iterationCheckedKey = 0;
        }
      }

      if (iterationCheckedKey === CHECKED_KEY.length) {
        finished = true;
      }

      if (finished && !savingFinished) {
        if (chunk[i] === '[' || chunk[i] === '{') {
          savingStarted = true;
          openSymbols++;
        } else if (chunk[i] === ']' || chunk[i] === '}') {
          openSymbols--;
        }

        if (savingStarted && !savingFinished) {
          content += chunk[i];
        }

        if (savingStarted && openSymbols <= 0) {
          savingFinished = true;
          break;
        }
      }

      i++;
    }

    // writeStream.write(content);
    chunk = '';

    // content += chunk.toString('utf-8');
  }

  const index = content.indexOf(AFTER_CONTENT_KEY);
  if (index !== -1) {
    content = content.substring(0, index); // Trim everything after AFTER_CONTENT_KEY
  }

  return content;
};

const streamToStringWithProcessing = async (stream: Readable): Promise<string> => {
  let content = '';
  const CHECKED_KEY = 'linear_conversation';
  const AFTER_CONTENT_KEY = ',"has_user_editable_context":';
  let iterationCheckedKey = 0;
  let finished = false;
  let openSymbols = 0;

  let savingStarted = false;
  let savingFinished = false;

  for await (const chunk of stream) {
    const chunkString = chunk.toString('utf-8');
    for (const char of chunkString) {
      if (!finished) {
        if (CHECKED_KEY[iterationCheckedKey] === char) {
          iterationCheckedKey++;
        } else {
          iterationCheckedKey = 0;
        }
      }

      if (iterationCheckedKey === CHECKED_KEY.length) {
        finished = true;
      }

      if (finished && !savingFinished) {
        if (char === '[' || char === '{') {
          savingStarted = true;
          openSymbols++;
        } else if (char === ']' || char === '}') {
          openSymbols--;
        }

        if (savingStarted) {
          content += char;
        }

        if (savingStarted && openSymbols <= 0) {
          savingFinished = true;
          break;
        }
      }
    }
  }

  const index = content.indexOf(AFTER_CONTENT_KEY);
  if (index !== -1) {
    content = content.substring(0, index); // Trim everything after AFTER_CONTENT_KEY
  }

  return content;
};

// Function to retrieve the file from S3
const getFileFromS3 = async (bucketName: string, key: string) => {
  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const response = await s3.send(command);

    // Convert the readable stream to a string
    if (response.Body) {
      // const fileContent = await streamToString(response.Body as Readable);
      const fileContent = await streamToStringWithProcessing(response.Body as Readable);
      console.log('File content retrieved from S3:', fileContent);
      return fileContent;
    }

    console.log('No file content available.');
    return null;
  } catch (error) {
    console.error('Error fetching file from S3:', error);
    throw error;
  }
};

// Function to delete the file from S3
const deleteFileFromS3 = async (bucketName: string, key: string) => {
  try {
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
    await s3.send(command);
    console.log(`File deleted from S3 bucket: ${bucketName}, key: ${key}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

// Function to process messages from SQS
const processSqsMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const queueUrl = await getQueueUrl(); // Dynamically retrieve QueueUrl

    const receiveParams = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1, // Adjust as needed
      WaitTimeSeconds: 20, // Enable long polling
    };

    const command = new ReceiveMessageCommand(receiveParams);
    const response = await sqs.send(command);

    const processedFiles = [];

    if (response.Messages) {
      for (const message of response.Messages) {
        console.log('Received message:', message.Body);

        // Parse the message body and handle it
        const parsedMessage = JSON.parse(message.Body || '{}');
        console.log('Parsed SQS message:', parsedMessage);

        const record = parsedMessage?.Records?.[0];
        if (record?.s3) {
          const bucketName = record.s3.bucket.name;
          const objectKey = decodeURIComponent(record.s3.object.key);

          console.log(`Fetching file from S3 bucket: ${bucketName}, key: ${objectKey}`);
          const fileContent = await getFileFromS3(bucketName, objectKey);

          // const parsedContent = await streamToString(fileContent);

          // Add file content or metadata to the processed files
          processedFiles.push({
            bucket: bucketName,
            key: objectKey,
            parsedContent: fileContent,
          });

          // Call your parseHtml handler with the file content
          // await parseHtml(fileContent);

          // Delete the file from S3 after processing
          await deleteFileFromS3(bucketName, objectKey);
        }

        // Delete the message after successful processing
        const deleteParams = {
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle!,
        };
        const deleteCommand = new DeleteMessageCommand(deleteParams);
        await sqs.send(deleteCommand);
        console.log('Message deleted:', message.MessageId);
      }
    } else {
      console.log('No messages to process.');
      res.send('No messages to process.');
      return;
    }

    res.status(200).json({
      processedFiles,
    });
  } catch (error) {
    console.error('Error processing SQS messages:', error);
    res.status(500).send('Error processing messages.');
  }
};

export default processSqsMessages;
