const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  PutBucketPolicyCommand,
} = require('@aws-sdk/client-s3');
const {
  IAMClient,
  UpdateAssumeRolePolicyCommand,
  PutRolePolicyCommand,
} = require('@aws-sdk/client-iam');
const fs = require('fs');
const path = require('path');
const { createIAMRole, getIAMRole } = require('./utils/createIAMRole');

// Environment variables
const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION;
const accountId = process.env.AWS_ACCOUNT_ID;
const frontendDir = path.join(__dirname, '../services/frontend/dist');
const deployUserArn = `arn:aws:iam::${accountId}:user/deploy-user`;

// Utility to add a delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Validate required environment variables
function validateEnvVariables() {
  const requiredVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'S3_BUCKET_NAME',
    'AWS_ACCOUNT_ID',
  ];
  const missingVars = requiredVars.filter((v) => !process.env[v]);

  if (missingVars.length) {
    console.error(`Missing environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
}

// Update IAM Role's Trust Relationship
const updateTrustRelationship = async (roleArn, roleName) => {
  const iamClient = new IAMClient({ region });
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          AWS: deployUserArn,
        },
        Action: 'sts:AssumeRole',
      },
    ],
  };

  try {
    console.log(`Updating trust relationship for role: ${roleName} (ARN: ${roleArn})`);
    await iamClient.send(
      new UpdateAssumeRolePolicyCommand({
        RoleName: roleName,
        PolicyDocument: JSON.stringify(trustPolicy),
      }),
    );
    console.log(`Trust relationship updated for role: ${roleName} (ARN: ${roleArn})`);
  } catch (error) {
    console.error(
      `Error updating trust relationship for role: ${roleName} (ARN: ${roleArn})`,
      error,
    );
    throw error;
  }
};

// Attach S3 Policy to IAM Role
const attachS3PolicyToRole = async (roleName) => {
  const iamClient = new IAMClient({ region });
  const s3Policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          's3:ListBucket',
          's3:HeadBucket',
          's3:CreateBucket',
          's3:PutObject',
          's3:GetObject',
          's3:DeleteObject',
        ],
        Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
      },
    ],
  };

  try {
    console.log(`Attaching S3 policy to role: ${roleName}`);
    await iamClient.send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: 'AllowS3Operations',
        PolicyDocument: JSON.stringify(s3Policy),
      }),
    );
    console.log(`S3 policy attached to role: ${roleName}`);
  } catch (error) {
    console.error(`Error attaching S3 policy to role: ${roleName}`, error);
    throw error;
  }
};

// Apply Public Policy to S3 Bucket
const applyPublicPolicyToBucket = async (s3Client, bucketName) => {
  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
    ],
  };

  try {
    console.log(`Applying public access policy to bucket: ${bucketName}`);
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy),
      }),
    );
    console.log(`Public access policy applied to bucket: ${bucketName}`);
  } catch (error) {
    console.error(`Error applying public access policy to bucket: ${bucketName}`, error);
    throw error;
  }
};

// Create S3 Bucket if Not Exists
const ensureBucketExists = async (s3Client, bucketName) => {
  try {
    console.log(`Checking if bucket "${bucketName}" exists...`);
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket "${bucketName}" already exists.`);
  } catch (error) {
    if (error.name === 'NotFound') {
      console.log(`Bucket "${bucketName}" does not exist. Creating...`);
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: { LocationConstraint: region },
        }),
      );
      console.log(`Bucket "${bucketName}" created successfully.`);
    } else {
      console.error(`Error checking bucket "${bucketName}":`, error);
      throw error;
    }
  }
};

const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
};

const uploadDir = async (s3Client, directory) => {
  if (!fs.existsSync(directory)) {
    console.error(`Directory "${directory}" does not exist.`);
    process.exit(1);
  }

  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const fileKey = path.relative(frontendDir, filePath);

    if (fs.lstatSync(filePath).isDirectory()) {
      await uploadDir(s3Client, filePath);
    } else {
      const fileContent = fs.readFileSync(filePath);
      const contentType = getContentType(file);

      console.log(`Uploading ${fileKey} to S3 with Content-Type: ${contentType}`);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: fileContent,
          ContentType: contentType,
        }),
      );
    }
  }
};

// Main Execution
(async () => {
  validateEnvVariables();

  const roleName = 'frontend-service-role';
  const s3Client = new S3Client({ region });

  try {
    let roleArn = await getIAMRole(roleName);
    if (!roleArn) {
      console.log(`IAM Role does not exist. Creating it...`);
      roleArn = await createIAMRole(roleName);
    }

    // Update Trust Relationship
    await updateTrustRelationship(roleArn, roleName);

    // Attach S3 Policy
    await attachS3PolicyToRole(roleName);

    // Ensure Bucket Exists
    await ensureBucketExists(s3Client, bucketName);

    // Apply Public Policy to Bucket
    await applyPublicPolicyToBucket(s3Client, bucketName);

    // Upload Files to S3
    await uploadDir(s3Client, frontendDir);

    console.log('All operations completed successfully.');
  } catch (error) {
    console.error('Error during execution:', error);
    process.exit(1);
  }
})();
