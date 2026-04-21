'use strict';

const { Router } = require('express');
const redis = require('../redis');

const router = Router();

const DEFAULT_TTL = 3600;

/**
 * Decode a JWT payload without verifying the signature.
 * Returns the parsed payload or null if malformed.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Extract session token (sub) from Authorization header.
 * Returns { sub, ttl } or null if missing/malformed.
 */
function extractSession(req) {
  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const payload = decodeJwtPayload(match[1]);
  if (!payload || !payload.sub) return null;

  const now = Math.floor(Date.now() / 1000);
  let ttl = DEFAULT_TTL;
  if (payload.exp && payload.exp > now) {
    ttl = payload.exp - now;
  }

  return { sub: payload.sub, ttl };
}

/**
 * Wrap a Redis call and return 503 on connection errors.
 */
async function withRedis(res, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('Redis unavailable:', err.message);
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
}

/**
 * Build the cart response object from a Redis hash.
 */
function buildCartResponse(sub, hash) {
  const items = Object.entries(hash).map(([productId, qty]) => ({
    productId,
    quantity: parseInt(qty, 10),
  }));
  return { sessionToken: sub, items };
}

// GET /cart
router.get('/', async (req, res) => {
  const session = extractSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const key = `cart:${session.sub}`;
  return withRedis(res, async () => {
    const hash = await redis.hgetall(key);
    return res.json(buildCartResponse(session.sub, hash || {}));
  });
});

// POST /cart/items  body: { productId, quantity }
router.post('/items', async (req, res) => {
  const session = extractSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { productId, quantity } = req.body;
  if (!productId || typeof quantity !== 'number' || quantity < 1) {
    return res.status(400).json({ error: 'productId and a positive quantity are required' });
  }

  const key = `cart:${session.sub}`;
  return withRedis(res, async () => {
    const pipeline = redis.pipeline();
    pipeline.hset(key, productId, quantity);
    pipeline.expire(key, session.ttl);
    await pipeline.exec();

    const hash = await redis.hgetall(key);
    return res.status(201).json(buildCartResponse(session.sub, hash || {}));
  });
});

// PUT /cart/items/:productId  body: { quantity }
router.put('/items/:productId', async (req, res) => {
  const session = extractSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { productId } = req.params;
  const { quantity } = req.body;
  if (typeof quantity !== 'number' || quantity < 1) {
    return res.status(400).json({ error: 'A positive quantity is required' });
  }

  const key = `cart:${session.sub}`;
  return withRedis(res, async () => {
    const pipeline = redis.pipeline();
    pipeline.hset(key, productId, quantity);
    pipeline.expire(key, session.ttl);
    await pipeline.exec();

    const hash = await redis.hgetall(key);
    return res.json(buildCartResponse(session.sub, hash || {}));
  });
});

// DELETE /cart/items/:productId
router.delete('/items/:productId', async (req, res) => {
  const session = extractSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { productId } = req.params;
  const key = `cart:${session.sub}`;

  return withRedis(res, async () => {
    await redis.hdel(key, productId);
    const hash = await redis.hgetall(key);
    return res.json(buildCartResponse(session.sub, hash || {}));
  });
});

// DELETE /cart
router.delete('/', async (req, res) => {
  const session = extractSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const key = `cart:${session.sub}`;
  return withRedis(res, async () => {
    await redis.del(key);
    return res.json(buildCartResponse(session.sub, {}));
  });
});

module.exports = router;
