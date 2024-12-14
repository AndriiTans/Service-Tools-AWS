const AWS = require('aws-sdk');

// Configure AWS SDK.
AWS.config.update({ region: 'us-east-1' });

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
const apiGateway = new AWS.APIGateway();

/**
 * Check if a User Pool with the specified name already exists.
 * @param {string} poolName - The name of the User Pool to check
 * @returns {Promise<object|null>} - Returns the User Pool if found, otherwise null
 */
async function getUserPoolByName(poolName) {
  try {
    const response = await cognitoIdentityServiceProvider
      .listUserPools({ MaxResults: 10 }) // Adjust MaxResults based on your setup
      .promise();

    const existingPool = response.UserPools.find((pool) => pool.Name === poolName);
    return existingPool || null;
  } catch (error) {
    console.error('Error checking existing user pools:', error.message);
    throw error;
  }
}

async function createUserPool() {
  const params = {
    PoolName: 'MyUserPool', // Replace with your desired pool name
    AutoVerifiedAttributes: ['email'], // Auto-verify email
    Policies: {
      PasswordPolicy: {
        MinimumLength: 6, // Set the minimum length to 6
        RequireUppercase: false, // No uppercase letter requirement
        RequireLowercase: false, // No lowercase letter requirement
        RequireNumbers: false, // No number requirement
        RequireSymbols: false, // No symbol requirement
      },
    },
    Schema: [
      {
        Name: 'email',
        AttributeDataType: 'String',
        Mutable: true,
        Required: true,
      },
    ],
  };

  try {
    const response = await cognitoIdentityServiceProvider.createUserPool(params).promise();
    console.log('User Pool Created:', response);
    return response.UserPool;
  } catch (error) {
    console.error('Error creating user pool:', error);
    throw error;
  }
}

async function createAppClient(userPoolId) {
  const params = {
    ClientName: 'MyAppClient', // Replace with your desired app client name
    UserPoolId: userPoolId,
    GenerateSecret: false, // Change to true if you need a client secret
    ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
  };

  try {
    const response = await cognitoIdentityServiceProvider.createUserPoolClient(params).promise();
    console.log('App Client Created:', response);
    return response.UserPoolClient;
  } catch (error) {
    console.error('Error creating app client:', error);
    throw error;
  }
}

/**
 * Check if the API Gateway already has a Cognito Authorizer.
 * @param {string} restApiId - The ID of the existing API Gateway
 * @param {string} authorizerName - The desired name for the authorizer
 * @returns {Promise<string|null>} - The Authorizer ID if found, otherwise null
 */
async function getExistingAuthorizer(restApiId, authorizerName) {
  try {
    const response = await apiGateway.getAuthorizers({ restApiId }).promise();
    const existingAuthorizer = response.items.find((auth) => auth.name === authorizerName);
    return existingAuthorizer ? existingAuthorizer.id : null;
  } catch (error) {
    console.error('Error fetching authorizers:', error.message);
    throw error;
  }
}

async function getAppClientByName(userPoolId, clientName) {
  try {
    const response = await cognitoIdentityServiceProvider
      .listUserPoolClients({ UserPoolId: userPoolId, MaxResults: 10 })
      .promise();

    const existingClient = response.UserPoolClients.find(
      (client) => client.ClientName === clientName,
    );
    return existingClient || null;
  } catch (error) {
    console.error('Error fetching existing app clients:', error.message);
    throw error;
  }
}

/**
 * Create a Cognito Authorizer for an existing API Gateway.
 * @param {string} restApiId - The ID of the existing API Gateway
 * @param {string} userPoolId - The Cognito User Pool ID
 * @param {string} region - AWS Region
 * @param {string} authorizerName - Name of the Authorizer
 * @returns {Promise<string>} - The Authorizer ID
 */
async function createCognitoAuthorizer(
  restApiId,
  userPoolId,
  region,
  authorizerName = 'MyCognitoAuthorizer',
) {
  const existingAuthorizerId = await getExistingAuthorizer(restApiId, authorizerName);

  if (existingAuthorizerId) {
    console.log(`Authorizer '${authorizerName}' already exists with ID: ${existingAuthorizerId}`);
    return existingAuthorizerId;
  }

  const params = {
    restApiId,
    name: authorizerName,
    type: 'COGNITO_USER_POOLS',
    identitySource: 'method.request.header.Authorization',
    providerARNs: [
      `arn:aws:cognito-idp:${region}:${process.env.AWS_ACCOUNT_ID}:userpool/${userPoolId}`,
    ],
  };

  try {
    const response = await apiGateway.createAuthorizer(params).promise();
    console.log(`Cognito Authorizer '${authorizerName}' created with ID: ${response.id}`);
    return response.id;
  } catch (error) {
    console.error('Error creating Cognito Authorizer:', error.message);
    throw error;
  }
}

async function setupCognitoAndAttachAuthorizer() {
  const poolName = 'MyUserPool'; // Replace with your desired pool name
  const apiName = 'app-api-gateway'; // The existing API Gateway name
  const region = 'us-east-1'; // AWS Region
  const appClientName = 'MyAppClient'; // Replace with your desired app client name

  try {
    // Step 1: Set up Cognito User Pool
    const existingPool = await getUserPoolByName(poolName);

    let userPool;
    if (existingPool) {
      console.log(`User Pool '${poolName}' already exists with ID: ${existingPool.Id}`);
      userPool = existingPool;
    } else {
      userPool = await createUserPool();
    }

    // Step 2: Check or Create App Client
    let appClient = await getAppClientByName(userPool.Id, appClientName);
    if (!appClient) {
      console.log(`App Client '${appClientName}' does not exist. Creating a new one...`);
      appClient = await createAppClient(userPool.Id);
    } else {
      console.log(`App Client '${appClientName}' already exists with ID: ${appClient.ClientId}`);
    }

    // Step 3: Fetch the existing API Gateway by name
    const apiGateways = await apiGateway.getRestApis().promise();
    const existingApi = apiGateways.items.find((api) => api.name === apiName);

    if (!existingApi) {
      throw new Error(`API Gateway '${apiName}' not found.`);
    }

    // Step 4: Create Cognito Authorizer for the API Gateway
    const authorizerId = await createCognitoAuthorizer(existingApi.id, userPool.Id, region);

    console.log('Setup Complete:');
    console.log('API Gateway ID:', existingApi.id);
    console.log('User Pool ID:', userPool.Id);
    console.log('App Client ID:', appClient.ClientId);
    console.log('Cognito Authorizer ID:', authorizerId);

    return {
      apiGatewayId: existingApi.id,
      userPoolId: userPool.Id,
      appClientId: appClient.ClientId,
      authorizerId,
    };
  } catch (error) {
    console.error('Error setting up Cognito and attaching Authorizer:', error.message);
    throw error;
  }
}

module.exports = { setupCognitoAndAttachAuthorizer };
