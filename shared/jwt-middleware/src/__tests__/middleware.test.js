'use strict';

const jwt = require('jsonwebtoken');
const { requireAuth } = require('../../index');

// Mock jwks-rsa to avoid real network calls
jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: (kid, callback) => {
      // Return a mock public key for testing
      // In real tests, we'll generate a real key pair
      callback(null, {
        getPublicKey: () => global.__TEST_PUBLIC_KEY__,
      });
    },
  }));
});

describe('JWT Middleware', () => {
  let mockReq, mockRes, mockNext;
  const testRegion = 'us-east-1';
  const testPoolId = 'us-east-1_TestPool';
  const expectedIssuer = `https://cognito-idp.${testRegion}.amazonaws.com/${testPoolId}`;

  // Generate a real RSA key pair for testing
  const crypto = require('crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  beforeAll(() => {
    global.__TEST_PUBLIC_KEY__ = publicKey;
  });

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Missing or invalid Authorization header', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header does not start with "Bearer "', async () => {
      mockReq.headers['authorization'] = 'Basic abc123';
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Expired token', () => {
    it('returns 401 when token is expired', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'user-123',
          email: 'user@example.com',
          'cognito:groups': ['customers'],
          iss: expectedIssuer,
          exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      mockReq.headers['authorization'] = `Bearer ${expiredToken}`;
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Wrong issuer (wrong pool)', () => {
    it('returns 401 when token has wrong issuer', async () => {
      const wrongIssuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_WrongPool';
      const wrongPoolToken = jwt.sign(
        {
          sub: 'user-123',
          email: 'user@example.com',
          'cognito:groups': ['customers'],
          iss: wrongIssuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      mockReq.headers['authorization'] = `Bearer ${wrongPoolToken}`;
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Malformed token', () => {
    it('returns 401 when token is not a valid JWT', async () => {
      mockReq.headers['authorization'] = 'Bearer not-a-valid-jwt';
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Malformed token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when token has no kid in header', async () => {
      // Create a token without kid
      const tokenWithoutKid = jwt.sign(
        {
          sub: 'user-123',
          iss: expectedIssuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        privateKey,
        { algorithm: 'RS256', noTimestamp: true }
      );

      mockReq.headers['authorization'] = `Bearer ${tokenWithoutKid}`;
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Malformed token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Valid token', () => {
    it('calls next() and sets req.user when token is valid', async () => {
      const validToken = jwt.sign(
        {
          sub: 'user-123',
          email: 'user@example.com',
          'cognito:groups': ['customers'],
          iss: expectedIssuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      mockReq.headers['authorization'] = `Bearer ${validToken}`;
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.sub).toBe('user-123');
      expect(mockReq.user.email).toBe('user@example.com');
      expect(mockReq.user['cognito:groups']).toEqual(['customers']);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('works with lowercase "authorization" header', async () => {
      const validToken = jwt.sign(
        {
          sub: 'admin-456',
          email: 'admin@shopcloud.internal',
          'cognito:groups': ['admins'],
          iss: expectedIssuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      mockReq.headers['authorization'] = `Bearer ${validToken}`;
      const middleware = requireAuth({ poolId: testPoolId, region: testRegion });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.sub).toBe('admin-456');
      expect(mockReq.user['cognito:groups']).toEqual(['admins']);
    });
  });

  describe('Factory function validation', () => {
    it('throws error when poolId is missing', () => {
      expect(() => requireAuth({ region: testRegion })).toThrow(
        'requireAuth: both poolId and region are required'
      );
    });

    it('throws error when region is missing', () => {
      expect(() => requireAuth({ poolId: testPoolId })).toThrow(
        'requireAuth: both poolId and region are required'
      );
    });
  });
});
