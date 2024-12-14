import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import { connectDB, disconnectDB } from './config/db';
import { S3Event, SqsEvent, streamToStringWithProcessing } from './handlers/processSqsRecords';
import Message from './models/message.model';
import { streamToString } from './handlers/processSqsMessages';

interface MessageMetadata {
  is_visually_hidden_from_conversation: boolean;
  shared_conversation_id: string;
}

interface Author {
  role: string;
  metadata: Record<string, unknown>;
}

interface Content {
  content_type: string;
  parts: string[];
}

interface Message {
  id: string;
  author: Author;
  content: Content;
  status: string;
  end_turn: boolean;
  weight: number;
  metadata: MessageMetadata;
  recipient: string;
}

interface Node {
  id: string;
  message?: Message;
  parent?: string;
  children: string[];
}

type RecordContent = Node;

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: SqsEvent): Promise<void> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  await connectDB();
  const session = await mongoose.startSession();

  try {
    if (!Boolean(event?.Records?.length > 0)) {
      console.log('No records to process');
      return;
    }

    session.startTransaction();

    let bucketName;
    let objectKey;

    for (const record of event.Records) {
      console.log('record ->> ', JSON.stringify(record, null, 2));
      console.log('=-=--=-==--=-==-');
      const parsedRecordBody: S3Event = JSON.parse(record.body || '{}');
      const s3Record = parsedRecordBody?.Records?.[0];

      console.log('s3Record ---> ', JSON.stringify(s3Record, null, 2));
      // Only proceed if the event indicates a file upload
      if (s3Record && s3Record.eventName === 'ObjectCreated:Put') {
        // const bucketName = s3Record.s3.bucket.name;
        bucketName = s3Record.s3.bucket.name;
        // const objectKey = decodeURIComponent(s3Record.s3.object.key);
        objectKey = decodeURIComponent(s3Record.s3.object.key);

        console.log(`Processing file: ${objectKey} from bucket: ${bucketName}`);
        //
        // Fetch the object from S3
        const getObjectParams = {
          Bucket: bucketName,
          Key: objectKey,
        };
        const command = new GetObjectCommand(getObjectParams);
        const response = await s3.send(command);

        if (response.Body) {
          // const fileContent = await streamToStringWithProcessing(response.Body as Readable);
          const fileContent = await streamToString(response.Body as Readable);
          console.log('Processed file content:', fileContent);

          if (!fileContent) {
            console.log('No file content');
            continue;
          }

          // const parsedFileContent: RecordContent[] = JSON.parse(fileContent);
          let parsedFileContent: RecordContent[];
          try {
            parsedFileContent = JSON.parse(fileContent);
          } catch (parseError) {
            console.error('Failed to parse file content:', parseError);
            continue;
          }

          console.log('parsedFileContent length -> ', parsedFileContent.length);
          let order = 0;
          const messagePromises = parsedFileContent
            .map((content) => {
              if (!content?.message) {
                return null;
              }

              console.log('message');
              console.log('content.message.content.parts -> ', content.message.content.parts);

              if (!content.message.content?.parts?.[0]) {
                return null;
              }

              const authorRole = content.message.author.role;

              const messageData = {
                bucketName: bucketName,
                fileName: objectKey,
                authorRole: authorRole,
                content: {
                  content_type: content.message.content.content_type,
                  parts: content.message.content.parts,
                },
                order: order++,
              };

              const message = new Message(messageData);

              return message.save();
            })
            .filter((promise) => promise);

          await Promise.all(messagePromises);
          console.log('Saved to database');
        } else {
          console.log(`No content found in S3 object: ${objectKey}`);
        }
      } else {
        console.log(`Skipping non-create event: ${s3Record.eventName}`);
      }
    }
    await session.commitTransaction();

    const deleteObjectParams = {
      Bucket: bucketName,
      Key: objectKey,
    };
    const deleteCommand = new DeleteObjectCommand(deleteObjectParams);
    await s3.send(deleteCommand);
    console.log(`File ${objectKey} deleted successfully from bucket ${bucketName}`);
  } catch (error) {
    await session.abortTransaction();
    console.error('Error processing event:', error);
  } finally {
    session.endSession();
    await disconnectDB(); // Disconnect from the database once processing is complete
  }
};
