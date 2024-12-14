const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda');

const {
  APIGatewayClient,
  CreateRestApiCommand,
  GetResourcesCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  CreateDeploymentCommand,
  GetRestApisCommand,
} = require('@aws-sdk/client-api-gateway');

/**
 * Adds permission to the Lambda function for API Gateway invocation.
 * @param {string} lambdaArn - The ARN of the Lambda function
 * @param {string} apiGatewayArn - The ARN of the API Gateway source
 */
const addLambdaPermission = async (lambdaArn, apiGatewayArn) => {
  const client = new LambdaClient({ region: 'us-east-1' });

  try {
    const permissionCommand = new AddPermissionCommand({
      FunctionName: lambdaArn,
      StatementId: `api-gateway-permission-${Date.now()}`,
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: apiGatewayArn,
    });
    await client.send(permissionCommand);
    console.log('Permission added to Lambda function for API Gateway.');
  } catch (error) {
    if (error.name === 'ResourceConflictException') {
      console.log('Permission already exists for Lambda function.');
    } else {
      console.error('Error adding permission to Lambda function:', error.message);
      throw error;
    }
  }
};

/**
 * Fetches an existing API Gateway by name.
 * @param {string} apiName - The name of the API Gateway
 * @returns {Promise<string|null>} - The REST API ID, or null if not found
 */
const getApiGateway = async (apiName) => {
  const client = new APIGatewayClient({ region: 'us-east-1' });
  try {
    const command = new GetRestApisCommand({});
    const response = await client.send(command);
    const existingApi = response.items.find((api) => api.name === apiName);
    return existingApi ? existingApi : null;
  } catch (error) {
    console.error('Error checking API Gateway:', error.message);
    throw error;
  }
};

const ensureResourceExists = async (restApiId, pathPart) => {
  const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

  try {
    console.log(`Checking if resource '${pathPart}' exists...`);
    const getResourcesCommand = new GetResourcesCommand({ restApiId });
    const resources = await client.send(getResourcesCommand);
    console.log('resources.items');
    console.log('resources.items');
    console.log('resources.items', resources.items);
    console.log('resources.items');
    console.log('resources.items');
    const existingResource = resources.items.find((item) => item.pathPart === pathPart);

    if (existingResource) {
      console.log(`Resource '${pathPart}' already exists with ID: ${existingResource.id}`);
      return existingResource.id;
    }

    return null;
  } catch (error) {
    console.error(`Error checking/creating resource '${pathPart}':`, error.message);
    throw error;
  }
};

/**
 * Adds the ANY HTTP method to a resource in an API Gateway.
 * @param {string} restApiId - The API Gateway ID
 * @param {string} resourceId - The resource ID
 * @param {string} integrationUri - The URI for Lambda integration
 */
const addAnyMethodToResource = async (restApiId, resourceId, integrationUri) => {
  const client = new APIGatewayClient({ region: 'us-east-1' });

  console.log(`Adding ANY method to resource ID: ${resourceId}...`);

  try {
    // Step 1: Add the ANY method to the resource
    const putMethodCommand = new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: 'ANY',
      authorizationType: 'NONE',
    });
    await client.send(putMethodCommand);

    // Step 2: Integrate the Lambda function with the ANY method
    const putIntegrationCommand = new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: 'ANY',
      type: 'AWS_PROXY',
      integrationHttpMethod: 'POST',
      uri: integrationUri,
    });
    await client.send(putIntegrationCommand);

    console.log(`ANY method integrated with URI: ${integrationUri}`);
  } catch (error) {
    console.error(`Error adding ANY method to resource:`, error.message);
    throw error;
  }
};

/**
 * Creates an API Gateway and integrates it with a Lambda function.
 * @param {string} apiName - The name of the API Gateway
 * @param {string} lambdaArn - The ARN of the Lambda function to integrate
 * @returns {Promise<string>} - The endpoint URL of the deployed API
 */
const createApiGateway = async (apiName, lambdaArn, pathPart) => {
  if (!apiName || !lambdaArn) {
    throw new Error('Both apiName and lambdaArn are required parameters.');
  }

  const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

  try {
    console.log(`Creating API Gateway: ${apiName}`);

    // Step 1: Create the REST API
    let restApi = await getApiGateway(apiName);
    if (!restApi) {
      console.log('1122112');
      console.log('121212');
      console.log('12121212');

      const createRestApiCommand = new CreateRestApiCommand({ name: apiName });
      console.log('STARTTT');
      restApi = await client.send(createRestApiCommand);
      console.log('CREATTTTTOMG', restApi);
      console.log(`API Gateway created with ID: ${restApi.id}`);
    }

    // Step 2: Get the root resource ID
    console.log('restApi.id');
    console.log('restApi.id', restApi.id);
    console.log('restApi.id');
    console.log('restApi.id');
    const getResourcesCommand = new GetResourcesCommand({ restApiId: restApi.id });
    const rootResource = await client.send(getResourcesCommand);
    const rootResourceId = rootResource.items.find((item) => item.path === '/').id;
    console.log(`Root resource ID: ${rootResourceId}`);

    // Step 3: Create or update resources for each Lambda
    // for (const { path, lambdaArn } of lambdas) {/
    const existedResourceId = await ensureResourceExists(restApi.id, pathPart);

    if (existedResourceId) {
      const endpointUrl = `https://${restApi.id}.execute-api.${
        process.env.AWS_REGION || 'us-east-1'
      }.amazonaws.com/prod/${pathPart}`;
      console.log(`API Gateway endpoint already exist: ${endpointUrl}`);
      return endpointUrl;
    }

    const createSubPathCommand = new CreateResourceCommand({
      restApiId: restApi.id,
      parentId: rootResourceId,
      pathPart,
    });
    const subPathResource = await client.send(createSubPathCommand);
    console.log(`Sub-path '/${pathPart}' created with ID: ${subPathResource.id}`);

    // Step 4: Create a `{proxy+}` resource under `/${pathPart}`
    const createProxyCommand = new CreateResourceCommand({
      restApiId: restApi.id,
      parentId: subPathResource.id,
      pathPart: '{proxy+}', // Proxy path
    });
    const proxyResource = await client.send(createProxyCommand);
    console.log(
      `Proxy resource '{proxy+}' created under '/${pathPart}' with ID: ${proxyResource.id}`,
    );

    // Step 5: Add ANY method to the proxy resource
    const integrationUri = `arn:aws:apigateway:${
      process.env.AWS_REGION || 'us-east-1'
    }:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`;

    await addAnyMethodToResource(restApi.id, proxyResource.id, integrationUri);

    // Step 6: Add Lambda permissions for API Gateway
    const apiGatewayArn = `arn:aws:execute-api:${process.env.AWS_REGION || 'us-east-1'}:${
      process.env.AWS_ACCOUNT_ID
    }:${restApi.id}/*`;
    await addLambdaPermission(lambdaArn, apiGatewayArn);

    // Step 7: Deploy the API to a stage (e.g., 'prod')
    const createDeploymentCommand = new CreateDeploymentCommand({
      restApiId: restApi.id,
      stageName: 'prod',
    });
    await client.send(createDeploymentCommand);
    console.log(`API deployed to stage: prod`);

    // Step 8: Return the API Gateway endpoint URL for `/${pathPart}`
    const endpointUrl = `https://${restApi.id}.execute-api.${
      process.env.AWS_REGION || 'us-east-1'
    }.amazonaws.com/prod/${pathPart}`;
    console.log(`API Gateway endpoint: ${endpointUrl}`);

    return endpointUrl;
  } catch (error) {
    console.error('Error creating API Gateway:', error);
    throw error;
  }
};

module.exports = { createApiGateway, getApiGateway };
