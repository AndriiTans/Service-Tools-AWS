const {
  APIGatewayClient,
  GetRestApisCommand,
  DeleteRestApiCommand,
} = require('@aws-sdk/client-api-gateway');

// Utility function to introduce a delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getTimestamp = () => {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // Extracts the date (YYYY-MM-DD)
  const time = now.toTimeString().split(' ')[0]; // Extracts time (HH:MM:SS)
  return `${date} - ${time}`;
};

const deleteApiGateways = async () => {
  console.log(`[${getTimestamp()}] Starting the deleteApiGateways...`);

  const client = new APIGatewayClient({ region: 'us-east-1' });

  try {
    // Step 1: List all APIs
    const listCommand = new GetRestApisCommand({});
    const response = await client.send(listCommand);
    const apis = response.items;

    if (!apis || apis.length === 0) {
      console.log('No API Gateways found.');
      return;
    }

    console.log(`Found ${apis.length} API Gateways.`);

    // Step 2: Delete APIs with a delay after each deletion
    for (const api of apis) {
      console.log(`Waiting 30 sec before deleting the next API Gateway...`);
      await sleep(30000);
      console.log(`Deleting API Gateway: ${api.name} (ID: ${api.id})`);
      const deleteCommand = new DeleteRestApiCommand({ restApiId: api.id });
      await client.send(deleteCommand);
      console.log(`Deleted API Gateway: ${api.name} (ID: ${api.id})`);
    }

    console.log('All API Gateways deleted successfully.');
  } catch (error) {
    console.error('Error deleting API Gateways:', error);
  }
};

module.exports = { deleteApiGateways };
