import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export type SqsEvent = {
  Records: Array<{
    messageId: string;
    receiptHandle: string;
    body: string; // JSON stringified S3 event
    attributes: {
      ApproximateReceiveCount: string;
      SentTimestamp: string;
      SenderId: string;
      ApproximateFirstReceiveTimestamp: string;
    };
    messageAttributes: Record<string, unknown>; // No custom attributes in the example
    md5OfBody: string;
    eventSource: string; // Should be "aws:sqs"
    eventSourceARN: string;
    awsRegion: string;
  }>;
};

type S3EventRecord = {
  eventVersion: string;
  eventSource: string; // Should be "aws:s3"
  awsRegion: string;
  eventTime: string;
  eventName: string; // E.g., "ObjectCreated:Put"
  userIdentity: {
    principalId: string;
  };
  requestParameters: {
    sourceIPAddress: string;
  };
  responseElements: {
    'x-amz-request-id': string;
    'x-amz-id-2': string;
  };
  s3: {
    s3SchemaVersion: string;
    configurationId: string;
    bucket: {
      name: string;
      ownerIdentity: {
        principalId: string;
      };
      arn: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
      sequencer: string;
    };
  };
};

export type S3Event = {
  Records: S3EventRecord[];
};

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const streamToStringWithProcessing = async (stream: Readable): Promise<string> => {
  console.log('streamToStringWithProcessing -----');
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

async function deleteS3Object(bucket: string, key: string): Promise<void> {
  try {
    const deleteParams = {
      Bucket: bucket,
      Key: key,
    };
    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);
    console.log(`Successfully deleted ${key} from ${bucket}`);
  } catch (error) {
    console.error(`Error deleting object ${key} from bucket ${bucket}:`, error);
    throw error;
  }
}

export const processSqsRecords = async (event: SqsEvent): Promise<void> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (!Boolean(event?.Records?.length > 0)) {
    console.log('if (!Boolean(event?.Records?.length > 0)) {');
    return;
  }

  console.log('RECORD LENGTH - >', event?.Records?.length);

  try {
    // Iterate over all records in the event
    for (const record of event.Records) {
      console.log('record ->> ', JSON.stringify(record, null, 2));
      console.log('=-=--=-==--=-==-');

      const parsedRecordBody: S3Event = JSON.parse(record.body || '{}');

      const s3Record = parsedRecordBody?.Records?.[0];

      console.log('s3Record ---> ', JSON.stringify(s3Record, null, 2));
      // Only proceed if the event indicates a file upload
      if (s3Record.eventName === 'ObjectCreated:Put') {
        const bucketName = s3Record.s3.bucket.name;
        const objectKey = decodeURIComponent(s3Record.s3.object.key);

        console.log(`Processing file: ${objectKey} from bucket: ${bucketName}`);

        // Fetch the object from S3
        const getObjectParams = {
          Bucket: bucketName,
          Key: objectKey,
        };
        const command = new GetObjectCommand(getObjectParams);
        const response = await s3.send(command);
        console.log('response.Body --> ', response);
        if (response.Body) {
          // Convert the object stream to a string
          const fileContent = await streamToStringWithProcessing(response.Body as Readable);
          console.log('fileContent -', fileContent);

          // to-do: parse and save data to db

          console.log('Deleting...');
          await deleteS3Object(bucketName, objectKey);
        } else {
          console.log(`No content found in the S3 object: ${objectKey}`);
        }
      } else {
        console.log(`Skipping event: ${s3Record.eventName}`);
      }
    }
  } catch (error) {
    console.error('Error processing S3 event:', error);
    throw error;
  }
};
