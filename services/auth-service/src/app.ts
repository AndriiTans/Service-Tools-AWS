import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import AWS from 'aws-sdk';
import logger from './utils/logger';
import { getTokenRemainingTime, isTokenExpired } from './utils/helpers';

dotenv.config();

AWS.config.update({ region: process.env.AWS_REGION });

const app = express();

///
const corsOptions = {
  // origin: process.env.FRONTEND_URL || '*', // Replace with your frontend URL in production
  origin: '*', // Replace with your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allows cookies to be sent
};

app.use(cors(corsOptions));

// Explicitly handle preflight requests
app.options('*', cors(corsOptions));
// app.use(cors());
////

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger);

const cognito = new AWS.CognitoIdentityServiceProvider();

async function refreshAccessToken(refreshToken) {
  const params = {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  };

  try {
    const response = await cognito.initiateAuth(params).promise();
    return response.AuthenticationResult; // Contains AccessToken and optionally IdToken
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error;
  }
}

app.get('/verify-token', async (req, res) => {
  const idToken = req.headers.authorization?.split(' ')[1]; // Extract ID token from Authorization header

  if (!idToken) {
    return res.status(400).json({ error: 'Missing token' });
  }

  if (isTokenExpired(idToken)) {
    return res.status(401).json({ error: 'Authentication failed' });
  } else {
    res.status(200).json({ message: 'Token valid' });
  }
});

app.get('/token-time-info', async (req, res) => {
  const idToken = req.headers.authorization?.split(' ')[1]; // Extract ID token from Authorization header

  if (!idToken) {
    return res.status(400).json({ error: 'Missing ID token' });
  }

  try {
    const remainingTime = getTokenRemainingTime(idToken);
    res.status(200).json({ tokenExpirationTime: remainingTime });
  } catch (error) {
    res.status(500).json({ error: 'Invalid token' });
  }
});

app.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    const newTokens = await refreshAccessToken(refreshToken);
    res.status(200).json(newTokens);
  } catch (error) {
    console.error('Failed to refresh token:', error.message);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

app.post('/register', async (req, res) => {
  const { password, email } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const params = {
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  };

  try {
    const response = await cognito.signUp(params).promise();
    res.status(200).json({ message: 'User registered successfully', response });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  };

  try {
    const response = await cognito.initiateAuth(params).promise();
    res.status(200).json({
      message: 'Login successful',
      tokens: response.AuthenticationResult,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.send('Hello from Auth service!');
});

app.get('/env', (req: Request, res: Response) => {
  res.json(process.env);
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message || err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
