import serverlessExpress from '@codegenie/serverless-express';
import app from './app';

const serverlessExpressInstance = serverlessExpress({ app });

export const handler = async (event, context) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

    return await serverlessExpressInstance(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
};
