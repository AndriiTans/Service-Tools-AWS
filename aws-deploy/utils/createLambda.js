const {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionConfigurationCommand,
  GetFunctionCommand,
} = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');

const DEFAULT_REGION = 'us-east-1'; // Configurable region
const DEFAULT_TIMEOUT = 15; // Default Lambda timeout
const RETRY_DELAY = 5000; // Delay between retries
const MAX_RETRIES = 5; // Max retries for waiting on function readiness

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for a Lambda function to become ready after an update or creation.
 */
const waitForFunctionToBeReady = async (
  functionName,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY,
) => {
  const client = new LambdaClient({ region: DEFAULT_REGION });
  console.log(`Waiting for Lambda function "${functionName}" to become ready...`);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const command = new GetFunctionConfigurationCommand({ FunctionName: functionName });
      const response = await client.send(command);

      if (response.State === 'Active' && response.LastUpdateStatus === 'Successful') {
        console.log(`Lambda function "${functionName}" is now ready.`);
        return;
      }

      if (response.State === 'Failed' || response.LastUpdateStatus === 'Failed') {
        throw new Error(`Function "${functionName}" failed with reason: ${response.StateReason}`);
      }

      console.log(
        `Function "${functionName}" state: ${response.State}, LastUpdateStatus: ${response.LastUpdateStatus}. Retrying in ${delay}ms...`,
      );
      await sleep(delay);
    } catch (error) {
      console.error(`Error checking function state for "${functionName}": ${error.message}`);
    }
  }

  throw new Error(
    `Lambda function "${functionName}" did not become ready after ${retries} attempts.`,
  );
};

/**
 * Logs the directory contents for debugging purposes.
 */
const listFiles = (dir) => {
  console.log(`Listing contents of directory: ${dir}`);
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === 'node_modules') return; // Skip node_modules
    const fullPath = path.join(dir, entry.name);
    console.log(entry.isDirectory() ? `[DIR] ${fullPath}` : fullPath);
    if (entry.isDirectory()) listFiles(fullPath); // Recursively list files
  });
};

/**
 * Deploy or update a Lambda function.
 */
const createLambdaFunction = async (
  functionName,
  roleArn,
  zipFilePath,
  handler,
  environmentVars,
  runtime = 'nodejs18.x',
) => {
  const client = new LambdaClient({ region: DEFAULT_REGION });

  console.log(`Deploying Lambda function: ${functionName}`);

  try {
    console.log('Current working directory:', process.cwd());
    listFiles(path.dirname(zipFilePath));

    if (!fs.existsSync(zipFilePath)) {
      throw new Error(`ZIP file not found: ${zipFilePath}`);
    }

    console.log('ZIP file found. Checking if the Lambda function already exists...');
    const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName });
    await client.send(getFunctionCommand);

    console.log(`Lambda function "${functionName}" exists. Proceeding with update...`);
    await waitForFunctionToBeReady(functionName);

    // Update function code
    console.log(`Updating function code for "${functionName}"...`);
    const zipFile = fs.readFileSync(zipFilePath);
    const updateFunctionCodeCommand = new UpdateFunctionCodeCommand({
      FunctionName: functionName,
      ZipFile: zipFile,
    });
    await client.send(updateFunctionCodeCommand);
    console.log(`Updated Lambda function code for "${functionName}".`);

    // Wait for the function to become ready after the code update
    await waitForFunctionToBeReady(functionName);

    // Update function configuration
    console.log(`Updating function configuration for "${functionName}"...`);
    const updateFunctionConfigCommand = new UpdateFunctionConfigurationCommand({
      FunctionName: functionName,
      Timeout: DEFAULT_TIMEOUT,
      Runtime: runtime,
      Environment: {
        Variables: environmentVars,
      },
    });
    const updateConfigResponse = await client.send(updateFunctionConfigCommand);
    console.log(
      `Updated configuration for "${functionName}". FunctionArn: ${updateConfigResponse.FunctionArn}`,
    );

    // Wait for the function to become ready after the configuration update
    await waitForFunctionToBeReady(functionName);

    return updateConfigResponse.FunctionArn;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`Lambda function "${functionName}" does not exist. Creating it...`);

      // Read ZIP file and create a new Lambda function
      const zipFile = fs.readFileSync(zipFilePath);
      const createFunctionCommand = new CreateFunctionCommand({
        FunctionName: functionName,
        Timeout: DEFAULT_TIMEOUT,
        Role: roleArn,
        Runtime: runtime,
        Handler: handler,
        Code: {
          ZipFile: zipFile,
        },
        Environment: {
          Variables: environmentVars,
        },
      });
      const createResponse = await client.send(createFunctionCommand);
      console.log(`Lambda function created: ${createResponse.FunctionArn}`);

      // Wait for the function to become ready
      await waitForFunctionToBeReady(functionName);

      return createResponse.FunctionArn;
    }

    if (error.message.includes('The operation cannot be performed at this time')) {
      console.error('Conflict: Another update is in progress. Retrying after delay...');
      await sleep(RETRY_DELAY);
      return createLambdaFunction(
        functionName,
        roleArn,
        zipFilePath,
        handler,
        environmentVars,
        runtime,
      );
    }

    console.error(`Error deploying Lambda function "${functionName}":`, error.message);
    throw error;
  }
};

module.exports = { createLambda: createLambdaFunction };
