'use strict';

const request = require('supertest');

// Mock the Cognito client before requiring the app
jest.mock('../cognito', () => {
  const mockSend = jest.fn();
  return {
    getCognitoClient: () => ({ send: mockSend }),
    pools: {
      customer: { userPoolId: 'us-east-1_customer', clientId: 'customer-client-id' },
      admin: { userPoolId: 'us-east-1_admin', clientId: 'admin-client-id' },
    },
    __mockSend: mockSend,
  };
});

const app = require('../index');
const { __mockSend: mockSend } = require('../cognito');

beforeEach(() => {
  mockSend.mockReset();
});

// ── /auth/register ────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('returns 201 on successful registration', async () => {
    mockSend.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/success/i);
  });

  it('returns 409 when email already exists', async () => {
    const err = new Error('exists');
    err.name = 'UsernameExistsException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'Password1!' });
    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid password', async () => {
    const err = new Error('bad pw');
    err.name = 'InvalidPasswordException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password does not meet requirements/i);
  });

  it('returns 400 when email or password missing', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 on InvalidParameterException (e.g. bad email format)', async () => {
    const err = new Error('Invalid email');
    err.name = 'InvalidParameterException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'notanemail', password: 'Password1!' });
    expect(res.status).toBe(400);
  });

  it('returns 500 on ResourceNotFoundException (misconfigured clientId)', async () => {
    const err = new Error('User pool client X does not exist');
    err.name = 'ResourceNotFoundException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(500);
  });

  it('returns 500 on CodeDeliveryFailureException with specific message', async () => {
    const err = new Error('Unable to deliver code');
    err.name = 'CodeDeliveryFailureException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/verification email/i);
  });

  it('returns 429 on TooManyRequestsException', async () => {
    const err = new Error('Rate exceeded');
    err.name = 'TooManyRequestsException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(429);
  });
});

// ── /auth/login ───────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  const authResult = {
    AuthenticationResult: {
      AccessToken: 'access-tok',
      IdToken: 'id-tok',
      RefreshToken: 'refresh-tok',
      ExpiresIn: 3600,
    },
  };

  it('returns 200 with tokens on valid credentials', async () => {
    mockSend.mockResolvedValueOnce(authResult);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: 'access-tok',
      idToken: 'id-tok',
      refreshToken: 'refresh-tok',
      expiresIn: 3600,
    });
  });

  it('returns 401 with generic message on NotAuthorizedException', async () => {
    const err = new Error('bad');
    err.name = 'NotAuthorizedException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 with same generic message on UserNotFoundException', async () => {
    const err = new Error('no user');
    err.name = 'UserNotFoundException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password1!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 403 when user has not confirmed email', async () => {
    const err = new Error('User not confirmed');
    err.name = 'UserNotConfirmedException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'unconfirmed@example.com', password: 'Password1!' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not confirmed/i);
  });

  it('returns 429 on TooManyRequestsException', async () => {
    const err = new Error('Rate exceeded');
    err.name = 'TooManyRequestsException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(429);
  });
});

// ── /auth/admin/login ─────────────────────────────────────────────────────────

describe('POST /auth/admin/login', () => {
  const authResult = {
    AuthenticationResult: {
      AccessToken: 'admin-access',
      IdToken: 'admin-id',
      RefreshToken: 'admin-refresh',
      ExpiresIn: 3600,
    },
  };

  it('returns 200 with tokens on valid admin credentials', async () => {
    mockSend.mockResolvedValueOnce(authResult);
    const res = await request(app)
      .post('/auth/admin/login')
      .send({ email: 'admin@shopcloud.internal', password: 'AdminPass1!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('admin-access');
  });

  it('returns 401 with generic message on invalid admin credentials', async () => {
    const err = new Error('bad');
    err.name = 'NotAuthorizedException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/admin/login')
      .send({ email: 'admin@shopcloud.internal', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

// ── /auth/refresh ─────────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  const authResult = {
    AuthenticationResult: {
      AccessToken: 'new-access',
      IdToken: 'new-id',
      RefreshToken: null,
      ExpiresIn: 3600,
    },
  };

  it('returns 200 with new tokens for customer pool', async () => {
    mockSend.mockResolvedValueOnce(authResult);
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'old-refresh', poolType: 'customer' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new-access');
    // falls back to original refresh token when Cognito doesn't return one
    expect(res.body.refreshToken).toBe('old-refresh');
  });

  it('returns 200 with new tokens for admin pool', async () => {
    mockSend.mockResolvedValueOnce(authResult);
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'admin-refresh', poolType: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new-access');
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ poolType: 'customer' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when poolType is invalid', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'tok', poolType: 'unknown' });
    expect(res.status).toBe(400);
  });

  it('returns 401 on expired/invalid refresh token', async () => {
    const err = new Error('expired');
    err.name = 'NotAuthorizedException';
    mockSend.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'expired-tok', poolType: 'customer' });
    expect(res.status).toBe(401);
  });
});

// ── Property: invalid credentials always return same message ──────────────────

describe('Property 14: generic error message for invalid credentials', () => {
  const fc = require('fast-check');

  it('login always returns identical message for NotAuthorizedException and UserNotFoundException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('NotAuthorizedException', 'UserNotFoundException'),
        async (errorName) => {
          const err = new Error('auth error');
          err.name = errorName;
          mockSend.mockRejectedValueOnce(err);
          const res = await request(app)
            .post('/auth/login')
            .send({ email: 'any@example.com', password: 'anypass' });
          return res.status === 401 && res.body.message === 'Invalid credentials';
        }
      ),
      { numRuns: 20 }
    );
  });
});
