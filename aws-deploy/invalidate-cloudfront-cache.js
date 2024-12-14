const {
  CloudFrontClient,
  ListCloudFrontOriginAccessIdentitiesCommand,
  CreateCloudFrontOriginAccessIdentityCommand,
  CreateDistributionCommand,
  CreateInvalidationCommand,
  ListDistributionsCommand,
  GetDistributionCommand,
  UpdateDistributionCommand,
} = require('@aws-sdk/client-cloudfront');
const {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  PutBucketPolicyCommand,
} = require('@aws-sdk/client-s3');
const { configureAwsPolicies } = require('./utils/s3/configureAwsS3Policies');

const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const region = process.env.AWS_REGION;
const bucketName = process.env.S3_BUCKET_NAME;
const AWS_SQS_QUEUE_NAME = process.env.AWS_SQS_QUEUE_NAME;

const updateS3BucketPolicyForCloudFront = async (s3Client, bucketName, distributionArn) => {
  const bucketPolicy = {
    Version: '2012-10-17',
    Id: 'PolicyForCloudFrontPrivateContent',
    Statement: [
      {
        Sid: 'AllowCloudFrontServicePrincipal',
        Effect: 'Allow',
        Principal: {
          Service: 'cloudfront.amazonaws.com',
        },
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/*`,
        Condition: {
          StringEquals: {
            'AWS:SourceArn': distributionArn,
          },
        },
      },
    ],
  };

  try {
    console.log(`Updating S3 bucket policy for CloudFront...`);
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy),
      }),
    );
    console.log('S3 bucket policy updated successfully.');
  } catch (error) {
    console.error('Error updating S3 bucket policy:', error);
    throw error;
  }
};

const updateContentTypeForIndex = async (s3Client, bucketName) => {
  try {
    console.log('Ensuring correct Content-Type for index.html...');
    const headCommand = new HeadObjectCommand({ Bucket: bucketName, Key: 'index.html' });
    const headResponse = await s3Client.send(headCommand);

    if (headResponse.ContentType !== 'text/html') {
      console.log('Updating Content-Type for index.html to text/html...');
      const copyCommand = new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/index.html`,
        Key: 'index.html',
        MetadataDirective: 'REPLACE',
        ContentType: 'text/html',
        Metadata: headResponse.Metadata,
      });
      await s3Client.send(copyCommand);
      console.log('Content-Type for index.html updated successfully.');
    } else {
      console.log('Content-Type for index.html is already correct.');
    }
  } catch (error) {
    console.error('Error ensuring Content-Type for index.html:', error);
    throw error;
  }
};

const getOrCreateOAI = async (cloudFrontClient) => {
  try {
    // Check if an OAI exists.
    console.log('Checking for existing CloudFront Origin Access Identity...');
    const listCommand = new ListCloudFrontOriginAccessIdentitiesCommand({});
    const response = await cloudFrontClient.send(listCommand);

    const existingOAI = response.CloudFrontOriginAccessIdentityList?.Items?.[0];
    if (existingOAI) {
      console.log('Existing OAI found:', existingOAI.Id);
      return existingOAI.Id;
    }

    // Create a new OAI if none exists
    console.log('No OAI found. Creating a new one...');
    const createCommand = new CreateCloudFrontOriginAccessIdentityCommand({
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: `oai-${Date.now()}`,
        Comment: 'OAI for CloudFront accessing S3',
      },
    });
    const createResponse = await cloudFrontClient.send(createCommand);
    console.log('New OAI created:', createResponse.CloudFrontOriginAccessIdentity.Id);
    return createResponse.CloudFrontOriginAccessIdentity.Id;
  } catch (error) {
    console.error('Error checking or creating OAI:', error);
    throw error;
  }
};

(async () => {
  const cloudFrontClient = new CloudFrontClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const oaiId = await getOrCreateOAI(cloudFrontClient);

    let distId = distributionId;
    let domainName;

    await updateContentTypeForIndex(s3Client, bucketName);

    if (!distId) {
      console.log('CloudFront Distribution ID not provided. Checking existing distributions...');

      const listCommand = new ListDistributionsCommand({});
      const response = await cloudFrontClient.send(listCommand);
      const { DistributionList } = response;

      if (DistributionList && DistributionList.Items && DistributionList.Items.length > 0) {
        const existingDistribution = DistributionList.Items.find((dist) =>
          dist.Origins.Items.some(
            (origin) => origin.DomainName === `${bucketName}.s3.amazonaws.com`,
          ),
        );

        if (existingDistribution) {
          distId = existingDistribution.Id;
          domainName = existingDistribution.DomainName;
          console.log(`Existing CloudFront Distribution found. Distribution ID: ${distId}`);
          console.log(`Domain Name: https://${domainName}`);
        }
      }

      if (!distId) {
        console.log('No existing distribution found. Creating a new CloudFront Distribution...');
        const createCommand = new CreateDistributionCommand({
          DistributionConfig: {
            CallerReference: `create-${Date.now()}`,
            Origins: {
              Quantity: 1,
              Items: [
                {
                  Id: bucketName,
                  DomainName: `${bucketName}.s3.amazonaws.com`,
                  S3OriginConfig: {
                    OriginAccessIdentity: `origin-access-identity/cloudfront/${oaiId}`,
                  },
                },
              ],
            },
            DefaultCacheBehavior: {
              TargetOriginId: bucketName,
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: {
                Quantity: 2,
                Items: ['GET', 'HEAD'],
              },
              CachedMethods: {
                Quantity: 2,
                Items: ['GET', 'HEAD'],
              },
              ForwardedValues: {
                QueryString: false,
                Cookies: { Forward: 'none' },
              },
              MinTTL: 0,
            },
            Comment: 'CloudFront distribution for S3 bucket',
            Enabled: true,
            DefaultRootObject: 'index.html',
            CustomErrorResponses: {
              Quantity: 1,
              Items: [
                {
                  ErrorCode: 404,
                  ResponsePagePath: '/index.html',
                  ResponseCode: '200',
                  ErrorCachingMinTTL: 300,
                },
              ],
            },
          },
        });

        const createResponse = await cloudFrontClient.send(createCommand);
        distId = createResponse.Distribution.Id;
        domainName = createResponse.Distribution.DomainName;

        console.log(`New CloudFront Distribution created. Distribution ID: ${distId}`);
        console.log(`Domain Name: https://${domainName}`);
      }
    } else {
      console.log(`Using existing CloudFront Distribution ID: ${distId}`);

      console.log(`Fetching configuration for distribution: ${distId}`);
      const { Distribution, ETag } = await cloudFrontClient.send(
        new GetDistributionCommand({ Id: distId }),
      );

      domainName = Distribution.DomainName;
      console.log(`Domain Name: https://${domainName}`);

      const config = Distribution.DistributionConfig;

      if (config.DefaultRootObject !== 'index.html') {
        console.log('Updating Default Root Object to index.html...');
        config.DefaultRootObject = 'index.html';

        await cloudFrontClient.send(
          new UpdateDistributionCommand({
            Id: distId,
            IfMatch: ETag,
            DistributionConfig: config,
          }),
        );

        console.log('CloudFront Distribution updated with Default Root Object: index.html');
      }
    }

    const accountId = process.env.AWS_ACCOUNT_ID;

    const distributionArn = `arn:aws:cloudfront::${accountId}:distribution/${distId}`;
    console.log('distributionArn');
    console.log('distributionArn');
    console.log('distributionArn');
    console.log('distributionArn', distributionArn);
    console.log('distributionArn');
    console.log('distributionArn');
    console.log('distributionArn');
    await updateS3BucketPolicyForCloudFront(s3Client, bucketName, distributionArn);

    if (distId) {
      console.log('Creating CloudFront cache invalidation...');
      const invalidationCommand = new CreateInvalidationCommand({
        DistributionId: distId,
        InvalidationBatch: {
          CallerReference: `invalidate-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: ['/*'],
          },
        },
      });

      const invalidationResponse = await cloudFrontClient.send(invalidationCommand);

      await configureAwsPolicies({
        bucketName,
        distributionId: distId,
        queueName: AWS_SQS_QUEUE_NAME,
      });

      console.log('CloudFront cache invalidation created successfully:', invalidationResponse);
      console.log(`Access your site at: https://${domainName}`);
    }
  } catch (error) {
    console.error('Error during CloudFront operation:', error);
    process.exit(1);
  }
})();
