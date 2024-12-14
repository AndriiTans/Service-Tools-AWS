const {
  SQSClient,
  CreateQueueCommand,
  GetQueueUrlCommand,
  SetQueueAttributesCommand,
} = require('@aws-sdk/client-sqs');
const { S3Client, PutBucketNotificationConfigurationCommand } = require('@aws-sdk/client-s3');
const { IAMClient, PutRolePolicyCommand } = require('@aws-sdk/client-iam'); // Add IAM client

const AWS_REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const AWS_SQS_QUEUE_NAME = process.env.AWS_SQS_QUEUE_NAME;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const LAMBDA_ROLE_NAME = process.env.LAMBDA_ROLE_NAME; // Name of the Lambda execution role

const sqs = new SQSClient({ region: AWS_REGION });
const s3 = new S3Client({ region: AWS_REGION });
const iam = new IAMClient({ region: AWS_REGION }); // IAM client for managing policies.

const setupS3ToSQSIntegration = async () => {
  console.log('----=-=-=-=-==--=-=');
  console.log('AWS_REGION -> ', AWS_REGION);
  console.log('BUCKET_NAME -> ', BUCKET_NAME);
  console.log('AWS_SQS_QUEUE_NAME -> ', AWS_SQS_QUEUE_NAME);
  console.log('ACCOUNT_ID -> ', ACCOUNT_ID);
  console.log('----=-=-=-=-==--=-=1');
  try {
    let QueueUrl;

    // Step 1: Check if the SQS queue already exists
    try {
      console.log('Checking if SQS queue exists...');
      const getQueueUrlCommand = new GetQueueUrlCommand({ QueueName: AWS_SQS_QUEUE_NAME });
      const response = await sqs.send(getQueueUrlCommand);
      QueueUrl = response.QueueUrl;
      console.log(`Queue already exists: ${QueueUrl}`);
    } catch (error) {
      if (error.name === 'QueueDoesNotExist') {
        console.log('Queue does not exist. Creating a new queue...');
        const createQueueCommand = new CreateQueueCommand({
          QueueName: AWS_SQS_QUEUE_NAME,
          Attributes: {
            DelaySeconds: '0',
            MessageRetentionPeriod: '86400', // Retain messages for 1 day
          },
        });

        const response = await sqs.send(createQueueCommand);
        QueueUrl = response.QueueUrl;
        console.log(`SQS queue created successfully: ${QueueUrl}`);
      } else {
        throw error;
      }
    }

    // Step 2: Set SQS Access Policy
    const queueArn = `arn:aws:sqs:${AWS_REGION}:${ACCOUNT_ID}:${AWS_SQS_QUEUE_NAME}`;
    const bucketArn = `arn:aws:s3:::${BUCKET_NAME}`;

    console.log('Setting SQS access policy for S3...');
    const policy = {
      Version: '2012-10-17',
      Id: 'S3AccessPolicy',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 's3.amazonaws.com',
          },
          Action: 'sqs:SendMessage',
          Resource: queueArn,
          Condition: {
            ArnEquals: {
              'aws:SourceArn': bucketArn,
            },
          },
        },
      ],
    };

    const setPolicyCommand = new SetQueueAttributesCommand({
      QueueUrl,
      Attributes: {
        Policy: JSON.stringify(policy),
      },
    });

    await sqs.send(setPolicyCommand);
    console.log('SQS access policy updated successfully.');

    // Step 3: Configure S3 Event Notifications
    console.log('Configuring S3 event notifications...');
    const notificationConfig = {
      Bucket: BUCKET_NAME,
      NotificationConfiguration: {
        QueueConfigurations: [
          {
            Events: ['s3:ObjectCreated:Put'],
            QueueArn: queueArn,
            Filter: {
              Key: {
                FilterRules: [
                  {
                    Name: 'prefix',
                    Value: 'uploads/', // Only trigger for objects in the "uploads/" folder
                  },
                ],
              },
            },
          },
        ],
      },
    };

    const setNotificationCommand = new PutBucketNotificationConfigurationCommand(
      notificationConfig,
    );
    await s3.send(setNotificationCommand);
    console.log('S3 event notifications configured successfully.');

    // Step 4: Add Lambda permissions for SQS.
    console.log('Adding Lambda permissions for SQS...');
    const lambdaPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'sqs:ReceiveMessage',
            'sqs:DeleteMessage',
            'sqs:GetQueueUrl',
            'sqs:GetQueueAttributes',
          ],
          Resource: queueArn,
        },
      ],
    };

    const putRolePolicyCommand = new PutRolePolicyCommand({
      RoleName: LAMBDA_ROLE_NAME,
      PolicyName: 'LambdaSQSPermissions',
      PolicyDocument: JSON.stringify(lambdaPolicy),
    });

    await iam.send(putRolePolicyCommand);
    console.log('Lambda permissions for SQS added successfully.');

    console.log(
      'Setup complete! S3 events will now send messages to the SQS queue for the "uploads/" folder, and Lambda can process them.',
    );
  } catch (error) {
    console.error('Error setting up S3 to SQS integration:', error);
  }
};

setupS3ToSQSIntegration();
