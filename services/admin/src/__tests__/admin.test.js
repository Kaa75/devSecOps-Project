'use strict';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../db');

// ── Helpers ────────────────────────────────────────────────────────────────

const request = require('supertest');
const app = require('../index');
const { breaker } = require('../db');

const ADMIN_POOL_ID = 'us-east-1_AdminPool';
process.env.COGNITO_ADMIN_POOL_ID = ADMIN_POOL_ID;

/**
 * Build a minimal fake JWT with the given payload.
 * The admin middleware only decodes (no signature verification).
 */
function makeJwt(payload = {}) {
  const defaults = {
    sub: 'admin-sub-123',
    email: 'admin@shopcloud.internal',
    iss: `https://cognito-idp.us-east-1.amazonaws.com/${ADMIN_POOL_ID}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const merged = { ...defaults, ...payload };
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(merged)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

const PRODUCT_ID = '00000000-0000-0000-0000-000000000001';

const PRODUCT_ROW = {
  id: PRODUCT_ID,
  name: 'Widget A',
  description: 'A great widget',
  price: '19.99',
  category: 'widgets',
  stock_quantity: 10,
  image_key: 'images/widget-a.jpg',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  breaker.fire.mockResolvedValue({ rows: [PRODUCT_ROW] });
});

// ── Auth middleware ────────────────────────────────────────────────────────

describe('Admin JWT middleware', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/admin/products').send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    // Must not expose product/inventory data
    expect(res.body).not.toHaveProperty('id');
    expect(res.body).not.toHaveProperty('name');
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .post('/admin/products')
      .set('Authorization', 'Bearer not.valid')
      .send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT is from the wrong pool (customer pool)', async () => {
    const wrongJwt = makeJwt({ iss: 'https://cognito-idp.us-east-1.amazonaws.com/CUSTOMER_POOL' });
    const res = await request(app)
      .post('/admin/products')
      .set('Authorization', `Bearer ${wrongJwt}`)
      .send({ name: 'Test', price: 9.99, category: 'test' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing Bearer prefix', async () => {
    const res = await request(app)
      .post('/admin/products')
      .set('Authorization', makeJwt())
      .send({});
    expect(res.status).toBe(401);
  });

  it('does not expose product data in 401 response', async () => {
    const res = await request(app).get('/admin/products').send({});
    // 401 body must not contain inventory fields
    expect(res.status).toBe(401);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/stock_quantity/);
    expect(body).not.toMatch(/price/);
  });
});

// ── POST /admin/products ───────────────────────────────────────────────────

describe('POST /admin/products', () => {
  it('returns 201 with created product', async () => {
    const res = await request(app)
      .post('/admin/products')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ name: 'Widget A', description: 'A great widget', price: 19.99, category: 'widgets', stock_quantity: 10, image_key: 'images/widget-a.jpg' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: PRODUCT_ID, name: 'Widget A' });
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/admin/products')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ description: 'No name or price' });

    expect(res.status).toBe(400);
  });

  it('returns 503 when DB is unavailable', async () => {
    const err = new Error('Service temporarily unavailable');
    err.status = 503;
    breaker.fire.mockRejectedValue(err);

    const res = await request(app)
      .post('/admin/products')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ name: 'Widget A', price: 19.99, category: 'widgets' });

    expect(res.status).toBe(503);
  });
});

// ── PUT /admin/products/:id ────────────────────────────────────────────────

describe('PUT /admin/products/:id', () => {
  it('returns 200 with updated product', async () => {
    const updated = { ...PRODUCT_ROW, name: 'Widget B', price: '29.99' };
    breaker.fire.mockResolvedValue({ rows: [updated] });

    const res = await request(app)
      .put(`/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ name: 'Widget B', price: 29.99 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: PRODUCT_ID, name: 'Widget B' });
  });

  it('returns 404 when product does not exist', async () => {
    breaker.fire.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .put(`/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).put(`/admin/products/${PRODUCT_ID}`).send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ── PATCH /admin/products/:id/stock ───────────────────────────────────────

describe('PATCH /admin/products/:id/stock', () => {
  it('returns 200 with updated stock', async () => {
    breaker.fire.mockResolvedValue({ rows: [{ id: PRODUCT_ID, stock_quantity: 50 }] });

    const res = await request(app)
      .patch(`/admin/products/${PRODUCT_ID}/stock`)
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ stock_quantity: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: PRODUCT_ID, stock_quantity: 50 });
  });

  it('returns 400 when stock_quantity is missing', async () => {
    const res = await request(app)
      .patch(`/admin/products/${PRODUCT_ID}/stock`)
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when product does not exist', async () => {
    breaker.fire.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .patch(`/admin/products/${PRODUCT_ID}/stock`)
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ stock_quantity: 5 });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`/admin/products/${PRODUCT_ID}/stock`)
      .send({ stock_quantity: 5 });
    expect(res.status).toBe(401);
  });
});

// ── POST /admin/products/:id/deactivate ───────────────────────────────────

describe('POST /admin/products/:id/deactivate', () => {
  it('returns 200 with is_active: false', async () => {
    breaker.fire.mockResolvedValue({ rows: [{ id: PRODUCT_ID, is_active: false }] });

    const res = await request(app)
      .post(`/admin/products/${PRODUCT_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: PRODUCT_ID, is_active: false });
  });

  it('returns 404 when product does not exist', async () => {
    breaker.fire.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post(`/admin/products/${PRODUCT_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post(`/admin/products/${PRODUCT_ID}/deactivate`);
    expect(res.status).toBe(401);
  });
});

// ── POST /admin/returns ────────────────────────────────────────────────────

describe('POST /admin/returns', () => {
  it('returns 200 with incremented stock', async () => {
    breaker.fire.mockResolvedValue({ rows: [{ id: PRODUCT_ID, stock_quantity: 12 }] });

    const res = await request(app)
      .post('/admin/returns')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ productId: PRODUCT_ID, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ productId: PRODUCT_ID, stock_quantity: 12 });
  });

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/admin/returns')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ quantity: 2 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is zero or negative', async () => {
    const res = await request(app)
      .post('/admin/returns')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ productId: PRODUCT_ID, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when product does not exist', async () => {
    breaker.fire.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/admin/returns')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ productId: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/admin/returns')
      .send({ productId: PRODUCT_ID, quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('returns 503 when DB is unavailable', async () => {
    const err = new Error('Service temporarily unavailable');
    err.status = 503;
    breaker.fire.mockRejectedValue(err);

    const res = await request(app)
      .post('/admin/returns')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ productId: PRODUCT_ID, quantity: 2 });

    expect(res.status).toBe(503);
  });
});

// ── GET /health ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with service name', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'admin' });
  });
});
