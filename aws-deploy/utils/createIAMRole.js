const {
  IAMClient,
  CreateRoleCommand,
  GetRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
} = require('@aws-sdk/client-iam');

const AWS_SQS_QUEUE_NAME = process.env.AWS_SQS_QUEUE_NAME;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getIAMRole = async (roleName) => {
  const client = new IAMClient({ region: 'us-east-1' });
  try {
    const command = new GetRoleCommand({ RoleName: roleName });
    const response = await client.send(command);
    return response.Role.Arn;
  } catch (error) {
    if (error.name === 'NoSuchEntity' || error.name === 'NoSuchEntityException') {
      return null; // Role does not exist
    }
    throw error; // Propagate other errors
  }
};

const createIAMRole = async (roleName) => {
  const client = new IAMClient({ region: 'us-east-1' });
  const assumeRolePolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'lambda.amazonaws.com',
        },
        Action: 'sts:AssumeRole',
      },
    ],
  };

  try {
    // Check if the role already exists
    console.log(`Checking if role "${roleName}" exists...`);
    const getRoleCommand = new GetRoleCommand({ RoleName: roleName });
    const response = await client.send(getRoleCommand);
    console.log(`Role already exists: ${response.Role.Arn}`);
    return response.Role.Arn;
  } catch (error) {
    if (error.name === 'NoSuchEntity' || error.message.includes('cannot be found')) {
      console.log(`Role "${roleName}" does not exist. Creating it...`);

      // Create the role
      const createRoleCommand = new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
      });
      const createResponse = await client.send(createRoleCommand);

      console.log('IAM Role created:', createResponse.Role.Arn);

      // Attach the AWSLambdaBasicExecutionRole policy
      const attachPolicyCommand = new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      });
      await client.send(attachPolicyCommand);
      console.log(`Policy AWSLambdaBasicExecutionRole attached to role: ${roleName}`);

      // Optional: Attach S3 Full Access Policy if needed
      const s3PolicyCommand = new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess',
      });
      await client.send(s3PolicyCommand);
      console.log(`Policy AmazonS3FullAccess attached to role: ${roleName}`);

      console.log(
        '`arn:aws:sqs:us-east-1:${ACCOUNT_ID}:${AWS_SQS_QUEUE_NAME}`',
        `arn:aws:sqs:us-east-1:${ACCOUNT_ID}:${AWS_SQS_QUEUE_NAME}`,
      );
      // Attach SQS Custom Inline Policy.
      const sqsPolicyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:GetQueueAttributes',
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueUrl',
            ],
            Resource: `arn:aws:sqs:us-east-1:${ACCOUNT_ID}:${AWS_SQS_QUEUE_NAME}`,
          },
        ],
      };

      const putPolicyCommand = new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: 'SQSPermissions',
        PolicyDocument: JSON.stringify(sqsPolicyDocument),
      });

      await client.send(putPolicyCommand);
      console.log(`Custom SQS permissions policy attached to role: ${roleName}`);

      // Wait for the role to propagate
      await sleep(10000); // Wait for 10 seconds
      return createResponse.Role.Arn;
    }

    console.error('Error checking or creating IAM Role:', error.message);
    throw error;
  }
};

module.exports = { createIAMRole, getIAMRole };
