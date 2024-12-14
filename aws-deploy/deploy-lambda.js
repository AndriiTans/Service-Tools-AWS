const { createLambda } = require('./utils/createLambda');
const { createApiGateway, getApiGateway } = require('./utils/createApiGateway');
const { deleteApiGateways } = require('./utils/deleteApiGateway');
const { createIAMRole, getIAMRole } = require('./utils/createIAMRole');

const ROLE_NAME = process.env.ROLE_NAME;
const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME;
const ZIP_FILE_PATH = process.env.ZIP_FILE_PATH;
const HANDLER_PATH = process.env.HANDLER_PATH;
const GATEWAY_API = process.env.GATEWAY_API;
const GATEWAY_API_SERVICE_PATH_PART = process.env.GATEWAY_API_SERVICE_PATH_PART;

(async () => {
  try {
    let environmentVars = {};
    if (process.env.SERVICE_ENV_VARS) {
      try {
        environmentVars = JSON.parse(process.env.SERVICE_ENV_VARS);

        console.log('Service Environment Variables:', environmentVars);
      } catch (error) {
        console.error('Failed to parse SERVICE_ENV_VARS:', error.message);
      }
    }

    console.log('ROLE_NAME --> ', ROLE_NAME);
    console.log('LAMBDA_FUNCTION_NAME --> ', LAMBDA_FUNCTION_NAME);
    console.log('ZIP_FILE_PATH --> ', ZIP_FILE_PATH);
    console.log('HANDLER_PATH --> ', HANDLER_PATH);
    console.log('GATEWAY_API --> ', GATEWAY_API);
    console.log('GATEWAY_API_SERVICE_PATH_PART --> ', GATEWAY_API_SERVICE_PATH_PART);

    console.log(`Deploying ${LAMBDA_FUNCTION_NAME}...`);

    // Step 1: Check or Create IAM Role
    console.log(`Checking IAM Role for ${LAMBDA_FUNCTION_NAME}...`);
    let roleArn = await getIAMRole(ROLE_NAME);
    if (!roleArn) {
      console.log(`IAM Role for ${LAMBDA_FUNCTION_NAME} does not exist. Creating it...`);
      roleArn = await createIAMRole(ROLE_NAME);
    }
    console.log(`IAM Role ready for ${LAMBDA_FUNCTION_NAME}: ${roleArn}`);
    console.log('process.env');
    console.log('process.env --> ', process.env);
    console.log('process.env');
    // Step 2: Deploy Lambda Function
    console.log(`Deploying Lambda Function for ${LAMBDA_FUNCTION_NAME}...`);
    const lambdaArn = await createLambda(
      LAMBDA_FUNCTION_NAME,
      roleArn,
      ZIP_FILE_PATH,
      HANDLER_PATH,
      environmentVars,
    );
    console.log(`Lambda Function deployed for ${LAMBDA_FUNCTION_NAME}: ${lambdaArn}`);

    // Step 3: Check or Create API Gateway
    // await deleteApiGateways();
    console.log(`Checking API Gateway for ${LAMBDA_FUNCTION_NAME}...`);
    // let apiUrl = await getApiGateway(service.apiName);
    // if (!apiUrl) {
    const apiUrl = await createApiGateway(GATEWAY_API, lambdaArn, GATEWAY_API_SERVICE_PATH_PART);
    // }
    console.log(`API Gateway ready for ${LAMBDA_FUNCTION_NAME}: ${apiUrl}`);

    console.log('Deployment completed successfully for all services!');
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
})();
