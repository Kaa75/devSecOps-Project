'use strict';

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Cache JWKS clients keyed by poolId to avoid creating a new client per request
const clientCache = new Map();

function getJwksClient(region, poolId) {
  const cacheKey = `${region}:${poolId}`;
  if (!clientCache.has(cacheKey)) {
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`;
    clientCache.set(
      cacheKey,
      jwksClient({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
      })
    );
  }
  return clientCache.get(cacheKey);
}

/**
 * Factory that returns an Express middleware validating a Cognito JWT.
 *
 * Usage:
 *   const { requireAuth } = require('@shopcloud/jwt-middleware');
 *   app.use(requireAuth({ poolId: process.env.COGNITO_CUSTOMER_POOL_ID, region: process.env.AWS_REGION }));
 *
 * On success  : attaches decoded payload to `req.user` and calls `next()`.
 * On failure  : responds with HTTP 401.
 */
function requireAuth({ poolId, region }) {
  if (!poolId || !region) {
    throw new Error('requireAuth: both poolId and region are required');
  }

  const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const client = getJwksClient(region, poolId);

  function getSigningKey(kid) {
    return new Promise((resolve, reject) => {
      client.getSigningKey(kid, (err, key) => {
        if (err) return reject(err);
        resolve(key.getPublicKey());
      });
    });
  }

  return async function jwtMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = jwt.decode(token, { complete: true });
    } catch {
      return res.status(401).json({ error: 'Malformed token' });
    }

    if (!decoded || !decoded.header || !decoded.header.kid) {
      return res.status(401).json({ error: 'Malformed token' });
    }

    let signingKey;
    try {
      signingKey = await getSigningKey(decoded.header.kid);
    } catch {
      return res.status(401).json({ error: 'Unable to retrieve signing key' });
    }

    let payload;
    try {
      payload = jwt.verify(token, signingKey, {
        algorithms: ['RS256'],
        issuer: expectedIssuer,
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = payload;
    return next();
  };
}

module.exports = { requireAuth };
