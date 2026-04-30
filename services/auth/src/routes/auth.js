'use strict';

const { Router } = require('express');
const {
  SignUpCommand,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { getCognitoClient, pools } = require('../cognito');

const router = Router();

// POST /auth/register — customer registration
router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    const client = getCognitoClient();
    await client.send(
      new SignUpCommand({
        ClientId: pools.customer.clientId,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    );
    return res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    if (err.name === 'UsernameExistsException') {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (err.name === 'InvalidPasswordException') {
      return res.status(400).json({ message: 'Password does not meet requirements' });
    }
    if (err.name === 'InvalidParameterException') {
      return res.status(400).json({ message: err.message || 'Invalid registration parameters' });
    }
    if (err.name === 'ResourceNotFoundException') {
      console.error('register error: Cognito client not found — check COGNITO_CUSTOMER_CLIENT_ID', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (err.name === 'CodeDeliveryFailureException') {
      console.error('register error: Cognito could not send verification email — check SES/Cognito email config', err);
      return res.status(500).json({ message: 'Account created but verification email could not be sent' });
    }
    if (err.name === 'TooManyRequestsException') {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    console.error('register error [%s]:', err.name, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/login — customer login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    const client = getCognitoClient();
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: pools.customer.clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      })
    );

    const auth = result.AuthenticationResult;
    return res.status(200).json({
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn,
    });
  } catch (err) {
    if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (err.name === 'UserNotConfirmedException') {
      return res.status(403).json({ message: 'Email not confirmed — check your inbox for a verification code' });
    }
    if (err.name === 'TooManyRequestsException') {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    console.error('login error [%s]:', err.name, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/admin/login — admin login (Admin Pool only)
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    const client = getCognitoClient();
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: pools.admin.clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      })
    );

    const auth = result.AuthenticationResult;
    return res.status(200).json({
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn,
    });
  } catch (err) {
    if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (err.name === 'UserNotConfirmedException') {
      return res.status(403).json({ message: 'Account not confirmed' });
    }
    if (err.name === 'TooManyRequestsException') {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    console.error('admin login error [%s]:', err.name, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/refresh — token refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken, poolType } = req.body || {};

  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken is required' });
  }

  const pool = pools[poolType];
  if (!pool) {
    return res.status(400).json({ message: 'poolType must be "customer" or "admin"' });
  }

  try {
    const client = getCognitoClient();
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: pool.clientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    const auth = result.AuthenticationResult;
    return res.status(200).json({
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken || refreshToken,
      expiresIn: auth.ExpiresIn,
    });
  } catch (err) {
    if (err.name === 'NotAuthorizedException' || err.name === 'TokenExpiredException') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    console.error('refresh error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
