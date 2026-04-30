'use strict';

const { Router } = require('express');
const {
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
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

// POST /auth/confirm — verify email with the code Cognito sends after sign-up
router.post('/confirm', async (req, res) => {
  const { email, code } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ message: 'email and code are required' });
  }

  try {
    const client = getCognitoClient();
    await client.send(
      new ConfirmSignUpCommand({
        ClientId: pools.customer.clientId,
        Username: email,
        ConfirmationCode: String(code),
      })
    );
    return res.status(200).json({ message: 'Email confirmed' });
  } catch (err) {
    if (err.name === 'CodeMismatchException') {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    if (err.name === 'ExpiredCodeException') {
      return res.status(400).json({ message: 'Verification code has expired — request a new one' });
    }
    if (err.name === 'NotAuthorizedException') {
      return res.status(409).json({ message: 'Account is already confirmed' });
    }
    if (err.name === 'UserNotFoundException') {
      return res.status(404).json({ message: 'Account not found' });
    }
    if (err.name === 'TooManyRequestsException') {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    console.error('confirm error [%s]:', err.name, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/resend-code — resend the email verification code
router.post('/resend-code', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  try {
    const client = getCognitoClient();
    await client.send(
      new ResendConfirmationCodeCommand({
        ClientId: pools.customer.clientId,
        Username: email,
      })
    );
    return res.status(200).json({ message: 'Verification code resent' });
  } catch (err) {
    if (err.name === 'UserNotFoundException') {
      return res.status(404).json({ message: 'Account not found' });
    }
    if (err.name === 'InvalidParameterException') {
      return res.status(409).json({ message: 'Account is already confirmed' });
    }
    if (err.name === 'TooManyRequestsException') {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    if (err.name === 'LimitExceededException') {
      return res.status(429).json({ message: 'Attempt limit exceeded, please try again later' });
    }
    console.error('resend-code error [%s]:', err.name, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
