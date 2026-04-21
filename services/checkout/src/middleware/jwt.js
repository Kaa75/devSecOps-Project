'use strict';

const jwt = require('jsonwebtoken');

/**
 * Lightweight JWT decode middleware for checkout service.
 * Decodes the JWT without signature verification (assumes API gateway/ALB handles verification).
 * Validates issuer contains the Customer Pool ID.
 * Returns 401 if missing/malformed/wrong pool.
 */
function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.decode(token, { complete: false });
  } catch {
    return res.status(401).json({ error: 'Malformed token' });
  }

  if (!decoded || !decoded.iss || !decoded.sub) {
    return res.status(401).json({ error: 'Malformed token' });
  }

  // Validate issuer contains the Customer Pool ID
  const expectedPoolId = process.env.COGNITO_CUSTOMER_POOL_ID;
  if (expectedPoolId && !decoded.iss.includes(expectedPoolId)) {
    return res.status(401).json({ error: 'Invalid token issuer' });
  }

  req.user = decoded;
  return next();
}

module.exports = { requireCustomerAuth };
