const {
  SQSClient,
  SetQueueAttributesCommand,
  GetQueueAttributesCommand,
} = require('@aws-sdk/client-sqs');
const {
  S3Client,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} = require('@aws-sdk/client-s3');

const AWS_REGION = process.env.AWS_REGION;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

const s3 = new S3Client({ region: AWS_REGION });
const sqs = new SQSClient({ region: AWS_REGION });

const configureAwsPolicies = async ({ bucketName, queueName, distributionId }) => {
  try {
    const queueArn = `arn:aws:sqs:${AWS_REGION}:${ACCOUNT_ID}:${queueName}`;
    const bucketArn = `arn:aws:s3:::${bucketName}`;
    const distributionArn = `arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${distributionId}`;

    console.log('Configuring AWS Policies...');
    console.log('queueArn -> ', queueArn);
    console.log('bucketArn -> ', bucketArn);
    console.log('distributionArn -> ', distributionArn);

    // Step 1: Check and Set S3 Bucket Policy
    console.log('Checking S3 Bucket Policy...');
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowCloudFrontServicePrincipal',
          Effect: 'Allow',
          Principal: {
            Service: 'cloudfront.amazonaws.com',
          },
          Action: 's3:GetObject',
          Resource: `${bucketArn}/*`,
          Condition: {
            StringEquals: {
              'AWS:SourceArn': distributionArn,
            },
          },
        },
      ],
    };

    try {
      const existingBucketPolicy = await s3.send(
        new GetBucketPolicyCommand({ Bucket: bucketName }),
      );
      if (JSON.stringify(bucketPolicy) === existingBucketPolicy.Policy) {
        console.log('S3 Bucket Policy is already up-to-date.');
      } else {
        console.log('Updating S3 Bucket Policy...');
        await s3.send(
          new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(bucketPolicy),
          }),
        );
        console.log('S3 Bucket Policy updated successfully.');
      }
    } catch (error) {
      if (error.name === 'NoSuchBucketPolicy') {
        console.log('No S3 Bucket Policy found. Adding new policy...');
        await s3.send(
          new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(bucketPolicy),
          }),
        );
        console.log('S3 Bucket Policy added successfully.');
      } else {
        throw error;
      }
    }

    // Step 2: Check and Set SQS Queue Policy
    console.log('Checking SQS Queue Policy...');
    const queuePolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3ToSendMessage',
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

    const queueUrl = `https://sqs.${AWS_REGION}.amazonaws.com/${ACCOUNT_ID}/${queueName}`;
    try {
      const existingQueueAttributes = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['Policy'],
        }),
      );

      if (
        existingQueueAttributes.Attributes &&
        JSON.stringify(queuePolicy) === existingQueueAttributes.Attributes.Policy
      ) {
        console.log('SQS Queue Policy is already up-to-date.');
      } else {
        console.log('Updating SQS Queue Policy...');
        await sqs.send(
          new SetQueueAttributesCommand({
            QueueUrl: queueUrl,
            Attributes: {
              Policy: JSON.stringify(queuePolicy),
            },
          }),
        );
        console.log('SQS Queue Policy updated successfully.');
      }
    } catch (error) {
      console.log('No existing policy found for SQS Queue. Adding new policy...');
      await sqs.send(
        new SetQueueAttributesCommand({
          QueueUrl: queueUrl,
          Attributes: {
            Policy: JSON.stringify(queuePolicy),
          },
        }),
      );
      console.log('SQS Queue Policy added successfully.');
    }

    // Step 3: Check and Configure S3 CORS Policy
    console.log('Checking S3 CORS Policy...');
    const desiredCorsConfiguration = [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
        AllowedOrigins: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000,
      },
    ];

    try {
      const currentCors = await s3.send(new GetBucketCorsCommand({ Bucket: bucketName }));
      if (
        JSON.stringify(currentCors.CORSRules || []) === JSON.stringify(desiredCorsConfiguration)
      ) {
        console.log('S3 CORS configuration is already up-to-date.');
      } else {
        throw new Error('CORS configuration differs.');
      }
    } catch (error) {
      console.log('Updating S3 CORS Policy...');
      await s3.send(
        new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: desiredCorsConfiguration,
          },
        }),
      );
      console.log('S3 CORS Policy configured successfully.');
    }
  } catch (error) {
    console.error('Error configuring AWS Policies:', error);
    throw error;
  }
};

module.exports = { configureAwsPolicies };
