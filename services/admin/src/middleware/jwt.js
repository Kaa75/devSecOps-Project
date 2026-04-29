'use strict';

const jwt = require('jsonwebtoken');

/**
 * Lightweight JWT decode middleware for admin service.
 * Decodes the JWT without signature verification.
 * Validates issuer contains the Admin Pool ID.
 * Returns 401 if missing/malformed/wrong pool — never exposes product/inventory data.
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.decode(token, { complete: false });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!decoded || !decoded.iss || !decoded.sub) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate issuer contains the Admin Pool ID
  const expectedPoolId = process.env.COGNITO_ADMIN_POOL_ID;
  if (expectedPoolId && !decoded.iss.includes(expectedPoolId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = decoded;
  return next();
}

module.exports = { requireAdminAuth };
