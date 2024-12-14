import serverlessExpress from '@codegenie/serverless-express';
import app from './app';

const serverlessExpressInstance = serverlessExpress({ app });

export const handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  return serverlessExpressInstance(event, context, callback);
};
