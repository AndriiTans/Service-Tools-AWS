const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda');
const {
  APIGatewayClient,
  CreateRestApiCommand,
  GetResourcesCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  UpdateGatewayResponseCommand,
  PutMethodResponseCommand,
  CreateDeploymentCommand,
  GetRestApisCommand,
  UpdateIntegrationResponseCommand,
} = require('@aws-sdk/client-api-gateway');

const { setupCognitoAndAttachAuthorizer } = require('./cognito-setup');

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
 * Adds an integration response to a specific method in API Gateway.
 * @param {string} restApiId - The API Gateway ID
 * @param {string} resourceId - The resource ID where the integration exists
 * @param {string} httpMethod - The HTTP method (e.g., GET, POST)
 * @param {string} statusCode - The status code for the response
 * @param {object} responseParameters - Response parameters to configure
 * @param {object} responseTemplates - Response templates to configure
 */
const addIntegrationResponse = async (
  restApiId,
  resourceId,
  httpMethod,
  statusCode,
  responseParameters = {},
  responseTemplates = {},
) => {
  const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

  try {
    const command = new UpdateIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod,
      statusCode,
      patchOperations: [
        {
          op: 'add',
          path: '/responseParameters',
          value: JSON.stringify(responseParameters),
        },
        {
          op: 'add',
          path: '/responseTemplates',
          value: JSON.stringify(responseTemplates),
        },
      ],
    });

    await client.send(command);
    console.log(`Integration response added for ${httpMethod} ${statusCode}`);
  } catch (error) {
    console.error(
      `Error adding integration response for ${httpMethod} ${statusCode}:`,
      error.message,
    );
    throw error;
  }
};

const addCORSOptionsForSubpath = async (restApiId, resourceId) => {
  const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

  const corsHeaders = {
    'method.response.header.Access-Control-Allow-Headers':
      "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    'method.response.header.Access-Control-Allow-Methods':
      "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'",
    'method.response.header.Access-Control-Allow-Origin': "'*'",
    'method.response.header.Access-Control-Allow-Credentials': 'true', // Set as a Boolean-compatible string
  };

  try {
    // Step 1: Create OPTIONS method
    const putMethodCommand = new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      authorizationType: 'NONE',
    });
    await client.send(putMethodCommand);

    // Step 2: Integrate the OPTIONS method with a MOCK integration
    const putIntegrationCommand = new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      type: 'MOCK',
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: corsHeaders,
          responseTemplates: {
            'application/json': '{"status": "CORS enabled"}',
          },
        },
      ],
    });
    await client.send(putIntegrationCommand);

    // Step 3: Set up the method response for OPTIONS
    const putMethodResponseCommand = new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Credentials': true, // Use a Boolean value
      },
    });
    await client.send(putMethodResponseCommand);

    console.log(
      `CORS integration response configured for OPTIONS method on resource ID: ${resourceId}`,
    );
  } catch (error) {
    console.error(`Error enabling CORS for OPTIONS method:`, error.message);
    throw error;
  }
};

/**
 * Enables CORS for Default 4XX and 5XX Gateway Responses.
 * @param {string} restApiId - The ID of the API Gateway
 */
const enableCORSForDefaultGatewayResponses = async (restApiId) => {
  const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

  const corsHeaders = {
    'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Api-Key,X-Amz-Security-Token'",
    'Access-Control-Allow-Methods': "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'",
    'Access-Control-Allow-Origin': "'*'",
    'Access-Control-Allow-Credentials': "'true'",
  };

  const updateGatewayResponse = async (responseType) => {
    try {
      const command = new UpdateGatewayResponseCommand({
        restApiId,
        responseType,
        patchOperations: [
          {
            op: 'replace',
            path: '/responseParameters/gatewayresponse.header.Access-Control-Allow-Headers',
            value: corsHeaders['Access-Control-Allow-Headers'],
          },
          {
            op: 'replace',
            path: '/responseParameters/gatewayresponse.header.Access-Control-Allow-Methods',
            value: corsHeaders['Access-Control-Allow-Methods'],
          },
          {
            op: 'replace',
            path: '/responseParameters/gatewayresponse.header.Access-Control-Allow-Origin',
            value: corsHeaders['Access-Control-Allow-Origin'],
          },
          {
            op: 'replace',
            path: '/responseParameters/gatewayresponse.header.Access-Control-Allow-Credentials',
            value: corsHeaders['Access-Control-Allow-Credentials'],
          },
        ],
      });
      await client.send(command);
      console.log(`CORS enabled for ${responseType}`);
    } catch (error) {
      console.error(`Failed to enable CORS for ${responseType}:`, error.message);
    }
  };

  // Enable CORS for Default 4XX and 5XX responses
  await updateGatewayResponse('DEFAULT_4XX');
  await updateGatewayResponse('DEFAULT_5XX');
};

/**
 * Adds the ANY HTTP method to a resource in an API Gateway.
 * @param {string} restApiId - The API Gateway ID
 * @param {string} resourceId - The resource ID
 * @param {string} integrationUri - The URI for Lambda integration
 * @param {string} authorizerId - The Cognito Authorizer ID
 */
const addAnyMethodToResource = async (restApiId, resourceId, integrationUri, authorizerId) => {
  const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

  console.log(`Adding ANY method to resource ID: ${resourceId}...`);

  try {
    // Step 1: Add the ANY method with Cognito Authorization
    console.log('authorizerId');
    console.log('authorizerId', authorizerId);
    console.log('authorizerId');
    const authParams = authorizerId
      ? { authorizationType: 'COGNITO_USER_POOLS', authorizerId }
      : { authorizationType: 'NONE' };

    const putMethodCommand = new PutMethodCommand({
      ...authParams,
      restApiId,
      resourceId,
      httpMethod: 'ANY',
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
 * @param {string} pathPart - The path for the resource
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

    // /////////////
    // /////////////
    // /////////////
    // // Enable CORS for the subpath
    // await addCORSOptionsForSubpath(restApi.id, subPathResource.id);
    // /////////////
    // /////////////
    // /////////////
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

    /////////////
    /////////////
    /////////////
    // Enable CORS for the subpath
    // await enableCORSForDefaultGatewayResponses(restApi.id);

    // await addCORSOptionsForSubpath(restApi.id, proxyResource.id);
    // Enable CORS for Default 4XX and 5XX responses
    /////////////
    /////////////
    /////////////

    // Step: Set up Cognito
    let authorizerId = null;
    if (pathPart !== 'auth') {
      console.log('Setting up Cognito...');
      const congnitoResponse = await setupCognitoAndAttachAuthorizer();
      authorizerId = congnitoResponse.authorizerId;
      console.log('Cognito Setup Complete:', authorizerId, congnitoResponse);
    }

    // Step 5: Add ANY method to the proxy resource
    const integrationUri = `arn:aws:apigateway:${
      process.env.AWS_REGION || 'us-east-1'
    }:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`;

    await addAnyMethodToResource(restApi.id, proxyResource.id, integrationUri);

    // Step 5: Add integration response for ANY method
    const responseParameters = {
      'method.response.header.Content-Type': "'application/json'",
    };
    const responseTemplates = {
      'application/json': '{"status": "success", "data": $input.json(\'$\') }',
    };

    // await addIntegrationResponse(
    //   restApi.id,
    //   proxyResource.id,
    //   'ANY',
    //   '200',
    //   responseParameters,
    //   responseTemplates,
    // );

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
