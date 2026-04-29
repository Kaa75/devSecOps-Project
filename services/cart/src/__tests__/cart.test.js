'use strict';

// Build a minimal fake JWT (cart only decodes, doesn't verify signature)
function makeJwt(sub = 'user-123', expOffset = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expOffset;
  const payload = Buffer.from(JSON.stringify({ sub, exp })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

// Shared mock Redis methods — mutated per test
const mockPipelineExec = jest.fn().mockResolvedValue([]);
const mockPipeline = {
  hset: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: mockPipelineExec,
};

const mockRedis = {
  hgetall: jest.fn().mockResolvedValue({}),
  hset: jest.fn().mockResolvedValue(1),
  hdel: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  pipeline: jest.fn().mockReturnValue(mockPipeline),
  on: jest.fn(),
};

// Mock ioredis so its constructor returns our mockRedis object
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Require app AFTER mock is set up
const request = require('supertest');
const app = require('../index');

beforeEach(() => {
  jest.clearAllMocks();
  // Re-attach pipeline mock after clearAllMocks
  mockRedis.pipeline.mockReturnValue(mockPipeline);
  mockPipeline.hset.mockReturnThis();
  mockPipeline.expire.mockReturnThis();
  mockPipelineExec.mockResolvedValue([]);
  mockRedis.hgetall.mockResolvedValue({});
  mockRedis.hdel.mockResolvedValue(1);
  mockRedis.del.mockResolvedValue(1);
});

describe('GET /cart', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 200 with cart data when authorized', async () => {
    mockRedis.hgetall.mockResolvedValue({ 'prod-1': '2' });

    const res = await request(app)
      .get('/cart')
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe('POST /cart/items', () => {
  it('adds item and returns cart with 201', async () => {
    mockRedis.hgetall.mockResolvedValue({ 'prod-1': '3' });

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ productId: 'prod-1', quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('items');
    expect(res.body.items[0]).toMatchObject({ productId: 'prod-1', quantity: 3 });
  });

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ quantity: 2 });

    expect(res.status).toBe(400);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/cart/items').send({ productId: 'p1', quantity: 1 });
    expect(res.status).toBe(401);
  });
});

describe('PUT /cart/items/:productId', () => {
  it('updates quantity and returns updated cart', async () => {
    mockRedis.hgetall.mockResolvedValue({ 'prod-1': '5' });

    const res = await request(app)
      .put('/cart/items/prod-1')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ productId: 'prod-1', quantity: 5 });
  });

  it('returns 400 for invalid quantity', async () => {
    const res = await request(app)
      .put('/cart/items/prod-1')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /cart/items/:productId', () => {
  it('removes item and returns updated cart', async () => {
    mockRedis.hgetall.mockResolvedValue({});

    const res = await request(app)
      .delete('/cart/items/prod-1')
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(200);
    expect(mockRedis.hdel).toHaveBeenCalledWith('cart:user-123', 'prod-1');
    expect(res.body.items).toEqual([]);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).delete('/cart/items/prod-1');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /cart', () => {
  it('clears the cart and returns empty items', async () => {
    const res = await request(app)
      .delete('/cart')
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(200);
    expect(mockRedis.del).toHaveBeenCalledWith('cart:user-123');
    expect(res.body.items).toEqual([]);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).delete('/cart');
    expect(res.status).toBe(401);
  });
});

describe('Redis unavailable', () => {
  it('returns 503 when Redis throws on GET /cart', async () => {
    mockRedis.hgetall.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app)
      .get('/cart')
      .set('Authorization', `Bearer ${makeJwt()}`);

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 503 when Redis pipeline throws on POST /cart/items', async () => {
    mockPipelineExec.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ productId: 'prod-1', quantity: 2 });

    expect(res.status).toBe(503);
  });
});
