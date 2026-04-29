'use strict';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../db');
jest.mock('../sqs');

const mockRedis = {
  del: jest.fn().mockResolvedValue(1),
  on: jest.fn(),
};
jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

// ── Helpers ────────────────────────────────────────────────────────────────

const request = require('supertest');
const app = require('../index');
const { pool, withTransaction } = require('../db');
const { publishOrderEvent } = require('../sqs');

const CUSTOMER_POOL_ID = 'us-east-1_TestPool';
process.env.COGNITO_CUSTOMER_POOL_ID = CUSTOMER_POOL_ID;

/**
 * Build a minimal fake JWT with the given payload.
 * The checkout middleware only decodes (no signature verification).
 */
function makeJwt(payload = {}) {
  const defaults = {
    sub: 'customer-sub-123',
    email: 'customer@example.com',
    iss: `https://cognito-idp.us-east-1.amazonaws.com/${CUSTOMER_POOL_ID}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const merged = { ...defaults, ...payload };
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(merged)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

const VALID_ITEMS = [{ productId: '00000000-0000-0000-0000-000000000001', quantity: 2 }];

const PRODUCT_ROW = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Widget A',
  price: '19.99',
  stock_quantity: 10,
};

const ORDER_ID = '00000000-0000-0000-0000-000000000099';

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.del.mockResolvedValue(1);
  publishOrderEvent.mockResolvedValue({});

  // Default: stock query returns a healthy product
  pool.query.mockResolvedValue({ rows: [PRODUCT_ROW] });

  // Default: withTransaction resolves with the new order ID
  withTransaction.mockImplementation(async (fn) => {
    await fn({
      query: jest.fn().mockResolvedValue({ rows: [{ id: ORDER_ID }] }),
    });
    return ORDER_ID;
  });
});

// ── POST /checkout ─────────────────────────────────────────────────────────

describe('POST /checkout', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/checkout').send({ items: VALID_ITEMS });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .post('/checkout')
      .set('Authorization', 'Bearer not.a.token')
      .send({ items: VALID_ITEMS });
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT is from the wrong pool', async () => {
    const wrongPoolJwt = makeJwt({ iss: 'https://cognito-idp.us-east-1.amazonaws.com/WRONG_POOL' });
    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${wrongPoolJwt}`)
      .send({ items: VALID_ITEMS });
    expect(res.status).toBe(401);
  });

  it('returns 400 when items array is missing', async () => {
    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when items array is empty', async () => {
    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 201 with orderId, status, and totalAmount on success', async () => {
    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      orderId: ORDER_ID,
      status: 'pending',
      totalAmount: 39.98,
    });
  });

  it('publishes an SQS order event on success', async () => {
    await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(publishOrderEvent).toHaveBeenCalledTimes(1);
    const event = publishOrderEvent.mock.calls[0][0];
    expect(event).toMatchObject({
      orderId: ORDER_ID,
      customerId: 'customer-sub-123',
      customerEmail: 'customer@example.com',
      totalAmount: 39.98,
    });
    expect(Array.isArray(event.items)).toBe(true);
    expect(event.items[0]).toMatchObject({
      productId: PRODUCT_ROW.id,
      productName: PRODUCT_ROW.name,
      quantity: 2,
      unitPrice: 19.99,
    });
    expect(event).toHaveProperty('createdAt');
  });

  it('clears the cart from Redis on success', async () => {
    await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(mockRedis.del).toHaveBeenCalledWith('cart:customer-sub-123');
  });

  it('returns 409 with outOfStockItems when stock is insufficient', async () => {
    pool.query.mockResolvedValue({
      rows: [{ ...PRODUCT_ROW, stock_quantity: 1 }], // only 1 in stock, need 2
    });

    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Insufficient stock',
      outOfStockItems: [PRODUCT_ROW.id],
    });
    expect(publishOrderEvent).not.toHaveBeenCalled();
  });

  it('returns 409 when product is not found (inactive or missing)', async () => {
    pool.query.mockResolvedValue({ rows: [] }); // product not found

    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(res.status).toBe(409);
    expect(res.body.outOfStockItems).toContain(PRODUCT_ROW.id);
    expect(publishOrderEvent).not.toHaveBeenCalled();
  });

  it('returns 503 when RDS is unavailable (pool.query throws 503)', async () => {
    const dbErr = new Error('Service temporarily unavailable');
    dbErr.status = 503;
    pool.query.mockRejectedValue(dbErr);

    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
    expect(publishOrderEvent).not.toHaveBeenCalled();
  });

  it('returns 503 when DB transaction fails with 503', async () => {
    const dbErr = new Error('Service temporarily unavailable');
    dbErr.status = 503;
    withTransaction.mockRejectedValue(dbErr);

    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(res.status).toBe(503);
    expect(publishOrderEvent).not.toHaveBeenCalled();
  });

  it('returns 500 when SQS publish fails', async () => {
    publishOrderEvent.mockRejectedValue(new Error('SQS unavailable'));

    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    expect(res.status).toBe(500);
  });

  it('still returns 201 when Redis cart clear fails (best-effort)', async () => {
    mockRedis.del.mockRejectedValue(new Error('Redis down'));

    const res = await request(app)
      .post('/checkout')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ items: VALID_ITEMS });

    // Cart clear is best-effort — should not fail the checkout
    expect(res.status).toBe(201);
  });
});

// ── GET /orders/:id ────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  const ORDER_ROW = {
    id: ORDER_ID,
    customer_id: 'customer-sub-123',
    customer_email: 'customer@example.com',
    status: 'pending',
    total_amount: '39.98',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [ORDER_ROW] });
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get(`/orders/${ORDER_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with order details for the owning customer', async () => {
    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orderId: ORDER_ID,
      status: 'pending',
      totalAmount: 39.98,
    });
  });

  it('returns 404 when order does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 when order belongs to a different customer', async () => {
    pool.query.mockResolvedValue({
      rows: [{ ...ORDER_ROW, customer_id: 'different-customer' }],
    });

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(403);
  });

  it('returns 503 when RDS is unavailable', async () => {
    const dbErr = new Error('Service temporarily unavailable');
    dbErr.status = 503;
    pool.query.mockRejectedValue(dbErr);

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(503);
  });
});

// ── GET /health ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with service name', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'checkout' });
  });
});
